import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { createHold, releaseHold, getCustomerHoldsForShow } from '../services/holdService';
import { confirmOrder, cancelBooking } from '../services/bookingService';
import { waitlistService } from '../services/waitlistService';

import rateLimit from 'express-rate-limit';

const router = Router();
router.use(requireAuth, requireRole('customer'));

// ─── Holds ────────────────────────────────────────────────────────────────────

const holdSchema = z.object({
  show_seat_id: z.string().uuid(),
});

const holdLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Allow up to 15 seat holds per minute per customer (headroom above the 6-seat limit)
  message: { error: 'Too many seat selections, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * POST /customer/holds
 * Create a hold on a seat. Concurrency-safe via Redis SETNX + Postgres FOR UPDATE.
 */
router.post('/holds', holdLimiter, asyncHandler(async (req, res) => {
  const { show_seat_id } = holdSchema.parse(req.body);
  const hold = await createHold(show_seat_id, req.user!.sub);
  res.status(201).json(hold);
}));

/**
 * GET /customer/holds/:showId
 * Get all active holds for the current user on a specific show.
 */
router.get('/holds/:showId', asyncHandler(async (req, res) => {
  const holds = await getCustomerHoldsForShow(req.user!.sub, req.params.showId);
  res.json(holds);
}));

/**
 * DELETE /customer/holds/:holdId
 * Release a hold (customer deselects a seat).
 */
router.delete('/holds/:holdId', asyncHandler(async (req, res) => {
  await releaseHold(req.params.holdId, req.user!.sub);
  res.json({ message: 'Hold released' });
}));

// ─── Orders ───────────────────────────────────────────────────────────────────

const orderSchema = z.object({
  hold_ids: z.array(z.string().uuid()).min(1).max(6),
});

/**
 * POST /customer/orders
 * Confirm holds into a booking order. One QR, one email.
 */
router.post('/orders', asyncHandler(async (req, res) => {
  const { hold_ids } = orderSchema.parse(req.body);
  const order = await confirmOrder(hold_ids, req.user!.sub);
  res.status(201).json(order);
}));

/**
 * GET /customer/orders
 * Order history with nested bookings.
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await pool.query(
    `SELECT o.id, o.booking_ref, o.total_price, o.status, o.email_sent,
            o.created_at, o.qr_data,
            e.title as event_title, e.type as event_type, e.poster_url,
            sh.starts_at, sh.ends_at,
            v.name as venue_name, v.city,
            json_agg(json_build_object(
              'booking_id', b.id,
              'show_seat_id', b.show_seat_id,
              'status', b.status,
              'price', b.price,
              'cancelled_at', b.cancelled_at,
              'row_label', s.row_label,
              'seat_number', s.seat_number,
              'category_name', sc.name,
              'category_color', sc.color_hex
            ) ORDER BY s.row_label, s.seat_number) as bookings
     FROM orders o
     JOIN shows sh ON sh.id = o.show_id
     JOIN events e ON e.id = sh.event_id
     JOIN venues v ON v.id = e.venue_id
     JOIN bookings b ON b.order_id = o.id
     JOIN show_seats ss ON ss.id = b.show_seat_id
     JOIN seats s ON s.id = ss.seat_id
     JOIN seat_categories sc ON sc.id = s.category_id
     WHERE o.customer_id = $1
     GROUP BY o.id, e.title, e.type, e.poster_url, sh.starts_at, sh.ends_at, v.name, v.city
     ORDER BY o.created_at DESC`,
    [req.user!.sub]
  );
  res.json(orders.rows);
}));

/**
 * GET /customer/orders/:id
 * Single order detail.
 */
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT o.id, o.booking_ref, o.total_price, o.status, o.email_sent, o.qr_data,
            o.created_at,
            e.title as event_title, e.type as event_type,
            sh.starts_at, sh.ends_at,
            v.name as venue_name, v.city,
            json_agg(json_build_object(
              'booking_id', b.id,
              'status', b.status,
              'price', b.price,
              'row_label', s.row_label,
              'seat_number', s.seat_number,
              'category_name', sc.name
            ) ORDER BY s.row_label, s.seat_number) as bookings
     FROM orders o
     JOIN shows sh ON sh.id = o.show_id
     JOIN events e ON e.id = sh.event_id
     JOIN venues v ON v.id = e.venue_id
     JOIN bookings b ON b.order_id = o.id
     JOIN show_seats ss ON ss.id = b.show_seat_id
     JOIN seats s ON s.id = ss.seat_id
     JOIN seat_categories sc ON sc.id = s.category_id
     WHERE o.id = $1 AND o.customer_id = $2
     GROUP BY o.id, e.title, e.type, sh.starts_at, sh.ends_at, v.name, v.city`,
    [req.params.id, req.user!.sub]
  );
  if (!result.rows[0]) throw new AppError(404, 'Order not found');
  res.json(result.rows[0]);
}));

/**
 * DELETE /customer/bookings/:bookingId
 * Cancel a single seat booking (partial cancel within order).
 * Triggers waitlist reassignment for the freed seat's category.
 */
router.delete('/bookings/:bookingId', asyncHandler(async (req, res) => {
  await cancelBooking(req.params.bookingId, req.user!.sub);
  res.json({ message: 'Booking cancelled' });
}));

// ─── Waitlist ─────────────────────────────────────────────────────────────────

const waitlistJoinSchema = z.object({
  category_id: z.string().uuid(),
});

/**
 * POST /customer/shows/:showId/waitlist
 * Join the waitlist for a category.
 */
router.post('/shows/:showId/waitlist', asyncHandler(async (req, res) => {
  const { category_id } = waitlistJoinSchema.parse(req.body);
  const result = await waitlistService.joinWaitlist(req.user!.sub, req.params.showId, category_id);
  res.status(201).json(result);
}));

const waitlistStatusQuerySchema = z.object({
  category_id: z.string().uuid(),
});

/**
 * GET /customer/shows/:showId/waitlist?category_id=...
 * Get waitlist position for the current user.
 */
router.get('/shows/:showId/waitlist', asyncHandler(async (req, res) => {
  const { category_id } = waitlistStatusQuerySchema.parse(req.query);
  const status = await waitlistService.getWaitlistStatus(req.user!.sub, req.params.showId, category_id);
  res.json(status);
}));

export default router;
