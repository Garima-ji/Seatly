import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { EVENT_TYPES, SHOW_STATUSES } from '../config/constants';

const router = Router();
router.use(requireAuth, requireRole('organiser'));

// ─── Events ───────────────────────────────────────────────────────────────────

const eventSchema = z.object({
  venue_id: z.string().uuid(),
  title: z.string().min(2).max(300),
  description: z.string().optional(),
  type: z.enum(EVENT_TYPES as unknown as [string, ...string[]]),
  poster_url: z.string().url().optional(),
});

router.post('/events', asyncHandler(async (req, res) => {
  const user = await pool.query('SELECT email_verified FROM users WHERE id = $1', [req.user!.sub]);
  if (user.rows[0] && !user.rows[0].email_verified) {
    throw new AppError(403, 'Please verify your email address before creating events.');
  }

  const body = eventSchema.parse(req.body);
  // Verify venue exists and is not deleted
  const venue = await pool.query(`SELECT id FROM venues WHERE id=$1 AND deleted_at IS NULL`, [body.venue_id]);
  if (!venue.rows[0]) throw new AppError(404, 'Venue not found');

  const result = await pool.query(
    `INSERT INTO events(organiser_id, venue_id, title, description, type, poster_url)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user!.sub, body.venue_id, body.title, body.description ?? null, body.type, body.poster_url ?? null]
  );
  res.status(201).json(result.rows[0]);
}));

router.get('/events', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT e.*, v.name as venue_name, v.city,
            COUNT(s.id) as show_count
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     LEFT JOIN shows s ON s.event_id = e.id
     WHERE e.organiser_id = $1
     GROUP BY e.id, v.name, v.city
     ORDER BY e.created_at DESC`,
    [req.user!.sub]
  );
  res.json(result.rows);
}));

router.get('/events/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT e.*, v.name as venue_name, v.city, v.address
     FROM events e JOIN venues v ON v.id = e.venue_id
     WHERE e.id = $1 AND e.organiser_id = $2`,
    [req.params.id, req.user!.sub]
  );
  if (!result.rows[0]) throw new AppError(404, 'Event not found');
  res.json(result.rows[0]);
}));

router.put('/events/:id', asyncHandler(async (req, res) => {
  const body = eventSchema.partial().parse(req.body);
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (body.title !== undefined) { fields.push(`title=$${i++}`); values.push(body.title); }
  if (body.description !== undefined) { fields.push(`description=$${i++}`); values.push(body.description); }
  if (body.type !== undefined) { fields.push(`type=$${i++}`); values.push(body.type); }
  if (body.poster_url !== undefined) { fields.push(`poster_url=$${i++}`); values.push(body.poster_url); }
  if (!fields.length) throw new AppError(400, 'No fields to update');
  fields.push('updated_at=now()');
  values.push(req.params.id, req.user!.sub);
  const result = await pool.query(
    `UPDATE events SET ${fields.join(',')} WHERE id=$${i} AND organiser_id=$${i+1} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new AppError(404, 'Event not found');
  res.json(result.rows[0]);
}));

// ─── Shows ────────────────────────────────────────────────────────────────────

const showSchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
});

router.post('/events/:id/shows', asyncHandler(async (req, res) => {
  const body = showSchema.parse(req.body);
  const event = await pool.query(
    `SELECT e.id, e.venue_id FROM events e WHERE e.id=$1 AND e.organiser_id=$2`,
    [req.params.id, req.user!.sub]
  );
  if (!event.rows[0]) throw new AppError(404, 'Event not found');

  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  if (endsAt <= startsAt) throw new AppError(400, 'ends_at must be after starts_at');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create show
    const showResult = await client.query(
      `INSERT INTO shows(event_id, starts_at, ends_at, status)
       VALUES($1,$2,$3,'draft') RETURNING *`,
      [req.params.id, startsAt, endsAt]
    );
    const show = showResult.rows[0];

    // Populate show_seats from venue's seats
    await client.query(
      `INSERT INTO show_seats(show_id, seat_id, status)
       SELECT $1, s.id, 'available'
       FROM seats s WHERE s.venue_id = $2`,
      [show.id, event.rows[0].venue_id]
    );

    await client.query('COMMIT');
    res.status(201).json(show);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.get('/events/:id/shows', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT s.* FROM shows s
     JOIN events e ON e.id = s.event_id
     WHERE s.event_id=$1 AND e.organiser_id=$2
     ORDER BY s.starts_at`,
    [req.params.id, req.user!.sub]
  );
  res.json(result.rows);
}));

/**
 * PATCH /organiser/shows/:id/status
 * Moves show through: draft → published → cancelled
 */
router.patch('/shows/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!SHOW_STATUSES.includes(status)) {
    throw new AppError(400, `Status must be one of: ${SHOW_STATUSES.join(', ')}`);
  }
  // Verify ownership
  const showRes = await pool.query(
    `SELECT s.id, s.status FROM shows s
     JOIN events e ON e.id = s.event_id
     WHERE s.id=$1 AND e.organiser_id=$2`,
    [req.params.id, req.user!.sub]
  );
  if (!showRes.rows[0]) throw new AppError(404, 'Show not found');
  const current = showRes.rows[0].status;

  // Transition rules
  const allowed: Record<string, string[]> = {
    draft: ['published', 'cancelled'],
    published: ['cancelled'],
    cancelled: [],
  };
  if (!allowed[current]?.includes(status)) {
    throw new AppError(409, `Cannot transition show from '${current}' to '${status}'`);
  }

  const result = await pool.query(
    `UPDATE shows SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [status, req.params.id]
  );
  res.json(result.rows[0]);
}));

/**
 * PUT /organiser/shows/:id/pricing
 * Set or update per-category prices for a show.
 */
const pricingSchema = z.object({
  prices: z.array(z.object({
    category_id: z.string().uuid(),
    price: z.coerce.number().min(0),
  })).min(1),
});

router.put('/shows/:id/pricing', asyncHandler(async (req, res) => {
  const { prices } = pricingSchema.parse(req.body);
  // Verify ownership
  const showRes = await pool.query(
    `SELECT s.id FROM shows s JOIN events e ON e.id = s.event_id
     WHERE s.id=$1 AND e.organiser_id=$2`,
    [req.params.id, req.user!.sub]
  );
  if (!showRes.rows[0]) throw new AppError(404, 'Show not found');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { category_id, price } of prices) {
      await client.query(
        `INSERT INTO show_seat_prices(show_id, category_id, price)
         VALUES($1,$2,$3)
         ON CONFLICT(show_id, category_id) DO UPDATE SET price=$3`,
        [req.params.id, category_id, price]
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      `SELECT ssp.*, sc.name as category_name
       FROM show_seat_prices ssp
       JOIN seat_categories sc ON sc.id = ssp.category_id
       WHERE ssp.show_id=$1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ─── Organiser Dashboard ──────────────────────────────────────────────────────

router.get('/events/:id/summary', asyncHandler(async (req, res) => {
  const event = await pool.query(
    `SELECT e.*, v.name as venue_name, v.city FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE e.id=$1 AND e.organiser_id=$2`,
    [req.params.id, req.user!.sub]
  );
  if (!event.rows[0]) throw new AppError(404, 'Event not found');

  interface ShowSummaryRow {
    id: string;
    starts_at: string | Date;
    ends_at: string | Date;
    status: string;
  }

  const shows = await pool.query<ShowSummaryRow>(
    `SELECT s.id, s.starts_at, s.ends_at, s.status FROM shows s
     WHERE s.event_id=$1 ORDER BY s.starts_at`,
    [req.params.id]
  );

  const summary = await Promise.all(
    shows.rows.map(async (show: ShowSummaryRow) => {
      const categories = await pool.query(
        `SELECT sc.id as category_id, sc.name as category_name, COALESCE(ssp.price, 0) as price,
                (SELECT COUNT(*) FROM show_seats ss2
                 JOIN seats s2 ON s2.id = ss2.seat_id
                 WHERE ss2.show_id = $1 AND s2.category_id = sc.id AND ss2.status != 'available') as total_sold_or_held,
                (SELECT COUNT(*) FROM show_seats ss2
                 JOIN seats s2 ON s2.id = ss2.seat_id
                 WHERE ss2.show_id = $1 AND s2.category_id = sc.id) as total_seats,
                (SELECT COUNT(*) FROM bookings b2
                 JOIN show_seats ss2 ON ss2.id = b2.show_seat_id
                 JOIN seats s2 ON s2.id = ss2.seat_id
                 WHERE ss2.show_id = $1 AND s2.category_id = sc.id AND b2.status = 'confirmed') as confirmed_bookings,
                (SELECT COUNT(*) FROM bookings b2
                 JOIN show_seats ss2 ON ss2.id = b2.show_seat_id
                 JOIN seats s2 ON s2.id = ss2.seat_id
                 WHERE ss2.show_id = $1 AND s2.category_id = sc.id AND b2.status = 'cancelled') as cancelled_bookings,
                COALESCE(
                  (SELECT SUM(b2.price) FROM bookings b2
                   JOIN show_seats ss2 ON ss2.id = b2.show_seat_id
                   JOIN seats s2 ON s2.id = ss2.seat_id
                   WHERE ss2.show_id = $1 AND s2.category_id = sc.id AND b2.status = 'confirmed'),
                  0
                ) as revenue
         FROM seat_categories sc
         JOIN show_seat_prices ssp ON ssp.show_id = $1 AND ssp.category_id = sc.id
         ORDER BY sc.display_order`,
        [show.id]
      );
      return { ...show, categories: categories.rows };
    })
  );

  res.json({ event: event.rows[0], shows: summary });
}));

// ─── Organiser Venues Read Access ───────────────────────────────────────────
router.get('/venues', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT v.*, COUNT(s.id) as total_seats
     FROM venues v
     LEFT JOIN seats s ON s.venue_id = v.id
     WHERE v.deleted_at IS NULL
     GROUP BY v.id
     ORDER BY v.name ASC`
  );
  res.json(result.rows);
}));

router.get('/venues/:id', asyncHandler(async (req, res) => {
  const venue = await pool.query(
    `SELECT * FROM venues WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );
  if (!venue.rows[0]) throw new AppError(404, 'Venue not found');

  const categories = await pool.query(
    `SELECT * FROM seat_categories WHERE venue_id = $1 ORDER BY display_order`,
    [req.params.id]
  );
  res.json({ ...venue.rows[0], categories: categories.rows });
}));

export default router;
