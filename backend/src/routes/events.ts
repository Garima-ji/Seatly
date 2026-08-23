import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { EVENT_TYPES } from '../config/constants';

const router = Router();

const eventQuerySchema = z.object({
  type: z.enum(EVENT_TYPES as unknown as [string, ...string[]]).optional(),
  city: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

/**
 * GET /events
 * Browse and filter public events (published shows only).
 * Query params: type, city, date (YYYY-MM-DD), page, limit
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const query = eventQuerySchema.parse(req.query);
  const { type, city, date, page, limit: limitNum } = query;

  const conditions: string[] = [`s.status = 'published'`, `v.deleted_at IS NULL`];
  const values: unknown[] = [];
  let i = 1;

  if (type && EVENT_TYPES.includes(type as typeof EVENT_TYPES[number])) {
    conditions.push(`e.type = $${i++}`);
    values.push(type);
  }

  if (city) {
    conditions.push(`LOWER(v.city) LIKE $${i++}`);
    values.push(`%${city.toLowerCase()}%`);
  }

  if (date) {
    conditions.push(`s.starts_at::date = $${i++}`);
    values.push(date);
  }

  const pageNum = page;
  const offset = (pageNum - 1) * limitNum;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limitNum, offset);

  const result = await pool.query(
    `SELECT DISTINCT ON (e.id)
            e.id, e.title, e.type, e.description, e.poster_url,
            v.id as venue_id, v.name as venue_name, v.city, v.address,
            s.id as next_show_id, s.starts_at as next_show_starts,
            ssp_agg.min_price, ssp_agg.max_price
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     JOIN shows s ON s.event_id = e.id
     LEFT JOIN LATERAL (
       SELECT MIN(price) as min_price, MAX(price) as max_price
       FROM show_seat_prices WHERE show_id = s.id
     ) ssp_agg ON true
     ${where}
     ORDER BY e.id, s.starts_at
     LIMIT $${i} OFFSET $${i + 1}`,
    values
  );

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT e.id) as total
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     JOIN shows s ON s.event_id = e.id
     ${where}`,
    values.slice(0, -2)
  );

  res.json({
    events: result.rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: parseInt(countResult.rows[0].total),
      pages: Math.ceil(parseInt(countResult.rows[0].total) / limitNum),
    },
  });
}));

/**
 * GET /events/shows/:showId/seatmap
 * Full seat map for a show. Returns per-seat status, category, price.
 * Used for the visual seat map component.
 * (Defined before /:id to prevent Express route collision)
 */
router.get('/shows/:showId/seatmap', optionalAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.sub ?? null;

  // Validate UUID format
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.showId)) {
    throw new AppError(404, 'Show not found');
  }

  const showRes = await pool.query(
    `SELECT s.id, s.status, s.starts_at, s.ends_at,
            e.title as event_title, v.name as venue_name
     FROM shows s
     JOIN events e ON e.id = s.event_id
     JOIN venues v ON v.id = e.venue_id
     WHERE s.id = $1`,
    [req.params.showId]
  );

  if (!showRes.rows[0]) throw new AppError(404, 'Show not found');

  const seats = await pool.query(
    `SELECT ss.id as show_seat_id, ss.seat_id, ss.status,
            s.row_label, s.seat_number, s.is_aisle,
            sc.id as category_id, sc.name as category_name, sc.color_hex, sc.display_order,
            ssp.price,
            CASE WHEN h.customer_id = $2 THEN true ELSE false END as held_by_me,
            CASE WHEN h.customer_id = $2 THEN h.expires_at ELSE NULL END as hold_expires_at,
            -- Waitlist: category sold-out flag
            (SELECT COUNT(*) = 0 FROM show_seats ss2
             JOIN seats s2 ON s2.id = ss2.seat_id
             WHERE ss2.show_id = ss.show_id AND s2.category_id = sc.id
             AND ss2.status = 'available') as category_sold_out
     FROM show_seats ss
     JOIN seats s ON s.id = ss.seat_id
     JOIN seat_categories sc ON sc.id = s.category_id
     LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
     LEFT JOIN holds h ON h.show_seat_id = ss.id
     WHERE ss.show_id = $1 AND s.is_aisle = false
     ORDER BY s.row_label, s.seat_number`,
    [req.params.showId, userId]
  );

  res.json({ show: showRes.rows[0], seats: seats.rows });
}));

/**
 * GET /events/:id
 * Get event details with all shows and cleanly aggregated categories.
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) {
    throw new AppError(404, 'Event not found');
  }

  const event = await pool.query(
    `SELECT e.*, v.name as venue_name, v.city, v.address
     FROM events e JOIN venues v ON v.id = e.venue_id
     WHERE e.id = $1`,
    [req.params.id]
  );
  if (!event.rows[0]) throw new AppError(404, 'Event not found');

  const shows = await pool.query(
    `SELECT s.id, s.starts_at, s.ends_at, s.status,
            COALESCE(
              json_agg(
                json_build_object(
                  'category_id', sc.id,
                  'category_name', sc.name,
                  'color_hex', sc.color_hex,
                  'price', COALESCE(ssp.price, 0),
                  'available_count', COALESCE(counts.avail_cnt, 0),
                  'total_count', COALESCE(counts.total_cnt, 0)
                ) ORDER BY sc.display_order
              ) FILTER (WHERE sc.id IS NOT NULL),
              '[]'::json
            ) as categories
     FROM shows s
     LEFT JOIN show_seat_prices ssp ON ssp.show_id = s.id
     LEFT JOIN seat_categories sc ON sc.id = ssp.category_id
     LEFT JOIN (
       SELECT ss.show_id, s.category_id,
              COUNT(*) FILTER (WHERE ss.status = 'available') as avail_cnt,
              COUNT(*) as total_cnt
       FROM show_seats ss
       JOIN seats s ON s.id = ss.seat_id
       GROUP BY ss.show_id, s.category_id
     ) counts ON counts.show_id = s.id AND counts.category_id = sc.id
     WHERE s.event_id = $1 AND s.status = 'published'
     GROUP BY s.id, s.starts_at, s.ends_at, s.status
     ORDER BY s.starts_at`,
    [req.params.id]
  );

  res.json({ ...event.rows[0], shows: shows.rows });
}));

export default router;
