import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { waitlistService } from '../services/waitlistService';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

import { z } from 'zod';

const router = Router();

const acceptQuerySchema = z.object({
  token: z.string().min(1, 'Token required'),
});

/**
 * GET /waitlist/accept/:offerId?token=...
 * Verify a signed waitlist offer token.
 * If valid, returns hold details for the frontend to display checkout.
 * The customer then POSTs to /customer/orders to confirm.
 */
router.get('/accept/:offerId', asyncHandler(async (req, res) => {
  const { token } = acceptQuerySchema.parse(req.query);

  const offer = await waitlistService.verifyOffer(req.params.offerId, token);

  // Return hold details — frontend will redirect to checkout with this holdId
  const holdInfo = await pool.query(
    `SELECT h.id as hold_id, h.expires_at,
            ss.show_id,
            s.row_label, s.seat_number,
            sc.name as category_name, sc.color_hex,
            ssp.price,
            e.title as event_title, sh.starts_at,
            v.name as venue_name, v.city
     FROM holds h
     JOIN show_seats ss ON ss.id = h.show_seat_id
     JOIN seats s ON s.id = ss.seat_id
     JOIN seat_categories sc ON sc.id = s.category_id
     LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
     JOIN shows sh ON sh.id = ss.show_id
     JOIN events e ON e.id = sh.event_id
     JOIN venues v ON v.id = e.venue_id
     WHERE h.id = $1 AND h.customer_id = $2`,
    [offer.hold_id, offer.customer_id]
  );

  if (!holdInfo.rows[0]) throw new AppError(404, 'Hold associated with this offer not found');

  res.json({
    valid: true,
    hold_id: offer.hold_id,
    customer_id: offer.customer_id,
    offer_expires_at: offer.expires_at.toISOString(),
    seat: holdInfo.rows[0],
  });
}));

/**
 * GET /waitlist/my
 * Get all active waitlist entries for the authenticated customer.
 */
router.get('/my', requireAuth, requireRole('customer'), asyncHandler(async (req, res) => {
  const entries = await pool.query(
    `SELECT we.id, we.show_id, we.category_id, we.status, we.created_at,
            sc.name as category_name, sc.color_hex,
            e.title as event_title, sh.starts_at,
            v.name as venue_name,
            wo.expires_at as offer_expires_at,
            ROW_NUMBER() OVER (
              PARTITION BY we.show_id, we.category_id
              ORDER BY we.created_at
            ) as position
     FROM waitlist_entries we
     JOIN seat_categories sc ON sc.id = we.category_id
     JOIN shows sh ON sh.id = we.show_id
     JOIN events e ON e.id = sh.event_id
     JOIN venues v ON v.id = e.venue_id
     LEFT JOIN waitlist_offers wo ON wo.entry_id = we.id AND wo.status = 'pending'
     WHERE we.customer_id = $1 AND we.status IN ('waiting','offered')
     ORDER BY we.created_at DESC`,
    [req.user!.sub]
  );
  res.json(entries.rows);
}));

export default router;
