import { pool, withTransaction } from '../db/pool';
import { redis } from '../redis/client';
import { getIO } from '../socket';
import { holdRedisKey, showRoom } from '../config/constants';
import { AppError } from '../middleware/errorHandler';
import { generateBookingRef, generateQRCode } from './qrService';
import { sendBookingConfirmation } from './emailService';
import { waitlistService } from './waitlistService';

/**
 * BookingService — Phase 3
 *
 * confirmOrder: converts an array of holds into a single order.
 * - Validates all holds belong to the same customer + show.
 * - Re-checks expires_at > now() inside transaction (never trust client state).
 * - Creates one orders row + N bookings rows.
 * - Generates one QR code, sends one email (both fire-and-forget after commit).
 * - Cancellation per-seat triggers waitlist reassignment.
 */

export interface ConfirmOrderResult {
  order_id: string;
  booking_ref: string;
  total_price: number;
  seats: {
    booking_id: string;
    show_seat_id: string;
    row_label: string;
    seat_number: number;
    category_name: string;
    price: number;
  }[];
  qr_data: string;
}

interface HoldRow {
  hold_id: string;
  show_seat_id: string;
  expires_at: Date;
  waitlist_offer_id: string | null;
  show_id: string;
  seat_id: string;
  status: string;
  row_label: string;
  seat_number: number;
  category_id: string;
  category_name: string;
  price: string | null;
  event_id: string;
  event_title: string;
  venue_name: string;
  city: string;
  starts_at: Date | string;
}

export async function confirmOrder(
  holdIds: string[],
  customerId: string
): Promise<ConfirmOrderResult> {
  if (!holdIds.length) throw new AppError(400, 'No hold IDs provided');
  if (holdIds.length > 6) throw new AppError(400, 'Cannot book more than 6 seats per order');

  return withTransaction(async (client) => {
    // ── 1. Validate all holds belong to this customer + same show ─────────────
    const holdsRes = await client.query<HoldRow>(
      `SELECT h.id as hold_id, h.show_seat_id, h.expires_at, h.waitlist_offer_id,
              ss.show_id, ss.seat_id, ss.status,
              s.row_label, s.seat_number,
              sc.id as category_id, sc.name as category_name,
              ssp.price,
              sh.event_id, sh.starts_at,
              e.title as event_title,
              v.name as venue_name, v.city
       FROM holds h
       JOIN show_seats ss ON ss.id = h.show_seat_id
       JOIN seats s ON s.id = ss.seat_id
       JOIN seat_categories sc ON sc.id = s.category_id
       LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
       JOIN shows sh ON sh.id = ss.show_id
       JOIN events e ON e.id = sh.event_id
       JOIN venues v ON v.id = e.venue_id
       WHERE h.id = ANY($1) AND h.customer_id = $2
       FOR UPDATE OF h, ss`,
      [holdIds, customerId]
    );

    if (holdsRes.rows.length !== holdIds.length) {
      throw new AppError(404, 'One or more holds not found or do not belong to you');
    }

    // ── 2. Check all holds are for the same show ────────────────────────────
    const showIds = [...new Set(holdsRes.rows.map((r: HoldRow) => r.show_id))];
    if (showIds.length > 1) throw new AppError(400, 'All holds must be for the same show');

    // ── 3. Check none are expired (re-validate, never trust client) ──────────
    const now = new Date();
    const expired = holdsRes.rows.filter((r: HoldRow) => new Date(r.expires_at) <= now);
    if (expired.length > 0) {
      throw new AppError(409, `Hold(s) have expired: ${expired.map((r: HoldRow) => `${r.row_label}${r.seat_number}`).join(', ')}`);
    }

    // ── 4. Check seat status is still 'held' ─────────────────────────────────
    const notHeld = holdsRes.rows.filter((r: HoldRow) => r.status !== 'held');
    if (notHeld.length > 0) {
      throw new AppError(409, 'One or more seats are no longer held');
    }

    const firstRow = holdsRes.rows[0];
    const showId = firstRow.show_id;
    const totalPrice = holdsRes.rows.reduce((sum: number, r: HoldRow) => sum + parseFloat(r.price ?? '0'), 0);

    // ── 5. Generate booking ref and QR ────────────────────────────────────────
    const bookingRef = await generateBookingRef(client);
    const qrData = await generateQRCode(bookingRef);

    // ── 6. Create order row ───────────────────────────────────────────────────
    const orderRes = await client.query(
      `INSERT INTO orders(customer_id, show_id, booking_ref, total_price, status, qr_data)
       VALUES($1, $2, $3, $4, 'confirmed', $5) RETURNING id`,
      [customerId, showId, bookingRef, totalPrice, qrData]
    );
    const orderId = orderRes.rows[0].id;

    // ── 7. Update each seat + create booking rows ─────────────────────────────
    const seatResults = [];
    for (const hold of holdsRes.rows) {
      await client.query(
        `UPDATE show_seats SET status = 'booked' WHERE id = $1`,
        [hold.show_seat_id]
      );

      const bookingRes = await client.query(
        `INSERT INTO bookings(order_id, show_seat_id, customer_id, hold_id, price, status)
         VALUES($1, $2, $3, $4, $5, 'confirmed') RETURNING id`,
        [orderId, hold.show_seat_id, customerId, hold.hold_id, parseFloat(hold.price ?? '0')]
      );

      // If this was a waitlist offer hold, mark the offer as accepted
      if (hold.waitlist_offer_id) {
        await client.query(
          `UPDATE waitlist_offers SET status = 'accepted' WHERE id = $1`,
          [hold.waitlist_offer_id]
        );
        await client.query(
          `UPDATE waitlist_entries SET status = 'fulfilled'
           WHERE id = (SELECT entry_id FROM waitlist_offers WHERE id = $1)`,
          [hold.waitlist_offer_id]
        );
      }

      seatResults.push({
        booking_id: bookingRes.rows[0].id,
        show_seat_id: hold.show_seat_id,
        row_label: hold.row_label,
        seat_number: hold.seat_number,
        category_name: hold.category_name,
        price: parseFloat(hold.price ?? '0'),
      });
    }

    // ── 8. Clean up hold rows (Redis keys expire naturally) ───────────────────
    await client.query(`DELETE FROM holds WHERE id = ANY($1)`, [holdIds]);

    return {
      order_id: orderId,
      booking_ref: bookingRef,
      total_price: totalPrice,
      seats: seatResults,
      qr_data: qrData,
      // Attach metadata for post-commit email
      _emailData: {
        orderId,
        showId,
        eventTitle: firstRow.event_title,
        showStartsAt: new Date(firstRow.starts_at ?? Date.now()),
        venueName: firstRow.venue_name,
        venueCity: firstRow.city,
      },
    } as ConfirmOrderResult & { _emailData: Record<string, unknown> };
  }).then(async (result) => {
    // ── Post-commit: broadcast + email + Redis cleanup ────────────────────────
    const emailMeta = (result as ConfirmOrderResult & { _emailData: Record<string, unknown> })._emailData;
    const io = getIO();
    for (const seat of result.seats) {
      io.to(showRoom((emailMeta?.showId as string) || '')).emit('seat:update', {
        showId: (emailMeta?.showId as string) || '',
        showSeatId: seat.show_seat_id,
        status: 'booked',
      });
      await redis.del(holdRedisKey(seat.show_seat_id));
    }

    // Fetch customer for email
    const customerRes = await pool.query(
      `SELECT full_name, email FROM users WHERE id = (
         SELECT customer_id FROM orders WHERE id = $1
       )`,
      [result.order_id]
    );

    if (customerRes.rows[0]) {
      const emailMeta = (result as ConfirmOrderResult & { _emailData: Record<string, unknown> })._emailData;
      sendBookingConfirmation({
        orderId: result.order_id,
        customerName: customerRes.rows[0].full_name,
        customerEmail: customerRes.rows[0].email,
        bookingRef: result.booking_ref,
        eventTitle: emailMeta.eventTitle as string,
        showStartsAt: emailMeta.showStartsAt as Date,
        venueName: emailMeta.venueName as string,
        venueCity: emailMeta.venueCity as string,
        seats: result.seats,
        totalPrice: result.total_price,
        qrDataUrl: result.qr_data,
      });
    }

    // Clean up _emailData from result before returning
    const { _emailData, ...cleanResult } = result as ConfirmOrderResult & { _emailData: unknown };
    return cleanResult as ConfirmOrderResult;
  });
}

/**
 * Cancel a single booking (partial cancel within an order).
 * Frees the seat and triggers waitlist reassignment for the category.
 */
export async function cancelBooking(
  bookingId: string,
  customerId: string
): Promise<void> {
  await withTransaction(async (client) => {
    const bookingRes = await client.query(
      `SELECT b.id, b.order_id, b.show_seat_id, b.status,
              ss.show_id, s.category_id,
              s.row_label, s.seat_number
       FROM bookings b
       JOIN show_seats ss ON ss.id = b.show_seat_id
       JOIN seats s ON s.id = ss.seat_id
       WHERE b.id = $1 AND b.customer_id = $2
       FOR UPDATE OF b`,
      [bookingId, customerId]
    );

    if (!bookingRes.rows[0]) throw new AppError(404, 'Booking not found');
    const booking = bookingRes.rows[0];
    if (booking.status === 'cancelled') throw new AppError(409, 'Booking already cancelled');

    // Cancel booking
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [bookingId]
    );

    // Free seat
    await client.query(
      `UPDATE show_seats SET status = 'available' WHERE id = $1`,
      [booking.show_seat_id]
    );

    // Update order status
    const remainingRes = await client.query(
      `SELECT COUNT(*) as confirmed FROM bookings WHERE order_id = $1 AND status = 'confirmed'`,
      [booking.order_id]
    );
    const confirmed = parseInt(remainingRes.rows[0].confirmed);
    const newOrderStatus = confirmed === 0 ? 'cancelled' : 'partially_cancelled';
    await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2`,
      [newOrderStatus, booking.order_id]
    );

    // Broadcast
    const io = getIO();
    io.to(showRoom(booking.show_id)).emit('seat:update', {
      showId: booking.show_id,
      showSeatId: booking.show_seat_id,
      status: 'available',
    });

    // Store for post-commit waitlist trigger
    (client as unknown as Record<string, unknown>)._cancelledSeatInfo = {
      showSeatId: booking.show_seat_id,
      categoryId: booking.category_id,
      showId: booking.show_id,
    };
  }).then(async () => {
    // Trigger waitlist reassignment after transaction commits
    // This avoids deadlocks with the advisory lock in waitlistService
    try {
      // Re-fetch the info we need (can't pass out of withTransaction cleanly here)
      const seatInfo = await pool.query(
        `SELECT ss.show_id, s.category_id
         FROM bookings b
         JOIN show_seats ss ON ss.id = b.show_seat_id
         JOIN seats s ON s.id = ss.seat_id
         WHERE b.id = $1`,
        [bookingId]
      );
      if (seatInfo.rows[0]) {
        // Get the show_seat_id for the cancelled booking
        const seatId = await pool.query(
          `SELECT show_seat_id FROM bookings WHERE id = $1`, [bookingId]
        );
        if (seatId.rows[0]) {
          await waitlistService.triggerReassignment(
            seatId.rows[0].show_seat_id,
            seatInfo.rows[0].category_id,
            seatInfo.rows[0].show_id
          );
        }
      }
    } catch (err) {
      console.error('[booking] Waitlist trigger error:', err);
    }
  });
}
