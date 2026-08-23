import { pool, withTransaction } from '../db/pool';
import { redis } from '../redis/client';
import { getIO } from '../socket';
import { holdRedisKey, showRoom, HOLD_TTL_SECONDS } from '../config/constants';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

/**
 * HoldService — Phase 2 core
 *
 * Concurrency strategy:
 * 1. Redis SETNX (fast-path pre-check): rejects obvious duplicates before hitting DB
 * 2. Postgres SELECT FOR UPDATE (source of truth): prevents race conditions
 *    that slip through the Redis pre-check (e.g., Redis restart, clock skew)
 * 3. Unique constraint on holds(show_seat_id): final DB-level safety net
 *
 * The Redis key is the hold TTL timer. Its expiry triggers the keyspace
 * subscriber which releases the hold in Postgres and broadcasts via sockets.
 */

export interface HoldResult {
  hold_id: string;
  show_seat_id: string;
  show_id: string;
  seat_id: string;
  expires_at: string;
  row_label: string;
  seat_number: number;
  category_id: string;
  category_name: string;
  price: number;
}

export async function createHold(
  showSeatId: string,
  customerId: string,
  ttlSeconds: number = HOLD_TTL_SECONDS,
  waitlistOfferId?: string
): Promise<HoldResult> {
  const redisKey = holdRedisKey(showSeatId);

  // ── Step 1: Redis SETNX fast-path pre-check ──────────────────────────────
  // NX = set only if Not eXists, EX = expiry in seconds
  const acquired = await redis.set(redisKey, customerId, 'EX', ttlSeconds, 'NX');
  if (!acquired) {
    throw new AppError(409, 'Seat is already held or booked');
  }

  try {
    // ── Step 2: Postgres transaction with SELECT FOR UPDATE ──────────────────
    const result = await withTransaction(async (client) => {
      // Lock the show_seat row exclusively — no other transaction can hold/book
      // this seat until we commit or rollback
      const seatRes = await client.query(
        `SELECT ss.id, ss.show_id, ss.seat_id, ss.status,
                s.row_label, s.seat_number,
                sc.id as category_id, sc.name as category_name,
                ssp.price
         FROM show_seats ss
         JOIN seats s ON s.id = ss.seat_id
         JOIN seat_categories sc ON sc.id = s.category_id
         LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
         WHERE ss.id = $1
         FOR UPDATE OF ss`,
        [showSeatId]
      );

      if (!seatRes.rows[0]) {
        throw new AppError(404, 'Seat not found');
      }

      const seat = seatRes.rows[0];

      // Check user is verified
      const userRes = await client.query(`SELECT email_verified FROM users WHERE id = $1`, [customerId]);
      if (userRes.rows[0] && !userRes.rows[0].email_verified) {
        throw new AppError(403, 'Please verify your email address to hold and book tickets.');
      }

      if (seat.status !== 'available') {
        throw new AppError(409, 'Seat is no longer available');
      }

      // Check the customer hasn't exceeded MAX_SEATS_PER_ORDER for this show
      const existingHolds = await client.query(
        `SELECT COUNT(*) as cnt FROM holds h
         JOIN show_seats ss ON ss.id = h.show_seat_id
         WHERE h.customer_id = $1 AND ss.show_id = $2 AND h.expires_at > now()`,
        [customerId, seat.show_id]
      );
      if (parseInt(existingHolds.rows[0].cnt) >= env.MAX_SEATS_PER_ORDER) {
        throw new AppError(409, `Maximum ${env.MAX_SEATS_PER_ORDER} seats per order allowed`);
      }

      // Update seat status
      await client.query(
        `UPDATE show_seats SET status = 'held' WHERE id = $1`,
        [showSeatId]
      );

      // Create hold record
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const holdRes = await client.query(
        `INSERT INTO holds(show_seat_id, customer_id, expires_at, waitlist_offer_id)
         VALUES($1, $2, $3, $4) RETURNING id, expires_at`,
        [showSeatId, customerId, expiresAt, waitlistOfferId ?? null]
      );

      return {
        hold_id: holdRes.rows[0].id,
        show_seat_id: showSeatId,
        show_id: seat.show_id,
        seat_id: seat.seat_id,
        expires_at: holdRes.rows[0].expires_at.toISOString(),
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        category_id: seat.category_id,
        category_name: seat.category_name,
        price: parseFloat(seat.price ?? 0),
      };
    });

    // ── Step 3: Broadcast to all clients viewing this show ───────────────────
    const io = getIO();
    io.to(showRoom(result.show_id)).emit('seat:update', {
      showId: result.show_id,
      showSeatId,
      status: 'held',
      heldByMe: false, // other clients see it as held-by-someone-else
    });

    return result;
  } catch (err) {
    // If anything fails after acquiring the Redis lock, release it
    await redis.del(redisKey);
    throw err;
  }
}

export async function releaseHold(
  holdId: string,
  customerId: string
): Promise<void> {
  await withTransaction(async (client) => {
    const holdRes = await client.query(
      `SELECT h.id, h.show_seat_id, ss.show_id
       FROM holds h JOIN show_seats ss ON ss.id = h.show_seat_id
       WHERE h.id = $1 AND h.customer_id = $2
       FOR UPDATE OF h`,
      [holdId, customerId]
    );

    if (!holdRes.rows[0]) {
      throw new AppError(404, 'Hold not found or does not belong to you');
    }

    const { show_seat_id, show_id } = holdRes.rows[0];

    await client.query(
      `UPDATE show_seats SET status = 'available' WHERE id = $1`,
      [show_seat_id]
    );
    await client.query(`DELETE FROM holds WHERE id = $1`, [holdId]);

    // Remove Redis key (may already be expired — that's fine)
    await redis.del(holdRedisKey(show_seat_id));

    const io = getIO();
    io.to(showRoom(show_id)).emit('seat:update', {
      showId: show_id,
      showSeatId: show_seat_id,
      status: 'available',
    });
  });
}

interface HoldRow {
  hold_id: string;
  show_seat_id: string;
  show_id: string;
  seat_id: string;
  expires_at: Date;
  row_label: string;
  seat_number: number;
  category_id: string;
  category_name: string;
  price: string | null;
}

/**
 * Get all active holds for a customer on a specific show.
 */
export async function getCustomerHoldsForShow(
  customerId: string,
  showId: string
): Promise<HoldResult[]> {
  const result = await pool.query<HoldRow>(
    `SELECT h.id as hold_id, h.show_seat_id, ss.show_id, ss.seat_id, h.expires_at,
            s.row_label, s.seat_number,
            sc.id as category_id, sc.name as category_name,
            ssp.price
     FROM holds h
     JOIN show_seats ss ON ss.id = h.show_seat_id
     JOIN seats s ON s.id = ss.seat_id
     JOIN seat_categories sc ON sc.id = s.category_id
     LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
     WHERE h.customer_id = $1 AND ss.show_id = $2 AND h.expires_at > now()
     ORDER BY s.row_label, s.seat_number`,
    [customerId, showId]
  );
  return result.rows.map((r: HoldRow) => ({
    ...r,
    expires_at: r.expires_at.toISOString(),
    price: parseFloat(r.price ?? '0'),
  }));
}
