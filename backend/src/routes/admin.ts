import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// ─── Venues ───────────────────────────────────────────────────────────────────

const venueSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5),
  city: z.string().min(2).max(100),
});

router.post('/venues', asyncHandler(async (req, res) => {
  const body = venueSchema.parse(req.body);
  const result = await pool.query(
    `INSERT INTO venues(name, address, city, created_by)
     VALUES($1,$2,$3,$4) RETURNING *`,
    [body.name, body.address, body.city, req.user!.sub]
  );
  res.status(201).json(result.rows[0]);
}));

router.get('/venues', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT v.*, u.full_name as created_by_name
     FROM venues v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.deleted_at IS NULL ORDER BY v.created_at DESC`
  );
  res.json(result.rows);
}));

router.get('/venues/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT v.*, u.full_name as created_by_name
     FROM venues v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.id = $1 AND v.deleted_at IS NULL`,
    [req.params.id]
  );
  if (!result.rows[0]) throw new AppError(404, 'Venue not found');
  res.json(result.rows[0]);
}));

router.put('/venues/:id', asyncHandler(async (req, res) => {
  const body = venueSchema.partial().parse(req.body);
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (body.name !== undefined) { fields.push(`name=$${i++}`); values.push(body.name); }
  if (body.address !== undefined) { fields.push(`address=$${i++}`); values.push(body.address); }
  if (body.city !== undefined) { fields.push(`city=$${i++}`); values.push(body.city); }
  if (!fields.length) throw new AppError(400, 'No fields to update');
  fields.push(`updated_at=now()`);
  values.push(req.params.id);
  const result = await pool.query(
    `UPDATE venues SET ${fields.join(',')} WHERE id=$${i} AND deleted_at IS NULL RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new AppError(404, 'Venue not found');
  res.json(result.rows[0]);
}));

router.delete('/venues/:id', asyncHandler(async (req, res) => {
  // Block soft-delete if live published shows exist
  const liveShows = await pool.query(
    `SELECT COUNT(*) FROM shows s
     JOIN events e ON e.id = s.event_id
     WHERE e.venue_id = $1 AND s.status = 'published'`,
    [req.params.id]
  );
  if (parseInt(liveShows.rows[0].count) > 0) {
    throw new AppError(409, 'Cannot delete venue with active published shows');
  }
  const result = await pool.query(
    `UPDATE venues SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
    [req.params.id]
  );
  if (!result.rows[0]) throw new AppError(404, 'Venue not found');
  res.json({ message: 'Venue soft-deleted', id: req.params.id });
}));

// ─── Seat Categories ──────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color like #6366f1'),
  display_order: z.coerce.number().int().default(0),
});

router.post('/venues/:id/seat-categories', asyncHandler(async (req, res) => {
  const body = categorySchema.parse(req.body);
  const venueCheck = await pool.query(`SELECT id FROM venues WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
  if (!venueCheck.rows[0]) throw new AppError(404, 'Venue not found');
  const result = await pool.query(
    `INSERT INTO seat_categories(venue_id, name, color_hex, display_order)
     VALUES($1,$2,$3,$4) RETURNING *`,
    [req.params.id, body.name, body.color_hex, body.display_order]
  );
  res.status(201).json(result.rows[0]);
}));

router.get('/venues/:id/seat-categories', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM seat_categories WHERE venue_id=$1 ORDER BY display_order, name`,
    [req.params.id]
  );
  res.json(result.rows);
}));

router.put('/seat-categories/:id', asyncHandler(async (req, res) => {
  const body = categorySchema.partial().parse(req.body);
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (body.name !== undefined) { fields.push(`name=$${i++}`); values.push(body.name); }
  if (body.color_hex !== undefined) { fields.push(`color_hex=$${i++}`); values.push(body.color_hex); }
  if (body.display_order !== undefined) { fields.push(`display_order=$${i++}`); values.push(body.display_order); }
  if (!fields.length) throw new AppError(400, 'No fields to update');
  fields.push('updated_at=now()');
  values.push(req.params.id);
  const result = await pool.query(
    `UPDATE seat_categories SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new AppError(404, 'Category not found');
  res.json(result.rows[0]);
}));

// ─── Seats (bulk create for a venue) ─────────────────────────────────────────

const seatSchema = z.object({
  row_label: z.string().min(1).max(4),
  seat_number: z.coerce.number().int().min(1),
  category_id: z.string().uuid(),
  is_aisle: z.boolean().default(false),
});

const bulkSeatsSchema = z.object({
  seats: z.array(seatSchema).min(1).max(2000),
});

router.post('/venues/:id/seats', asyncHandler(async (req, res) => {
  const { seats } = bulkSeatsSchema.parse(req.body);
  const venueId = req.params.id;

  // Validate venue exists
  const venueCheck = await pool.query(`SELECT id FROM venues WHERE id=$1 AND deleted_at IS NULL`, [venueId]);
  if (!venueCheck.rows[0]) throw new AppError(404, 'Venue not found');

  // Bulk insert using unnest for performance
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let created = 0;
    for (const seat of seats) {
      await client.query(
        `INSERT INTO seats(venue_id, category_id, row_label, seat_number, is_aisle)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (venue_id, row_label, seat_number) DO UPDATE
         SET category_id=$2, is_aisle=$5`,
        [venueId, seat.category_id, seat.row_label, seat.seat_number, seat.is_aisle]
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ created, venue_id: venueId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.get('/venues/:id/seats', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, sc.name as category_name, sc.color_hex
     FROM seats s JOIN seat_categories sc ON sc.id = s.category_id
     WHERE s.venue_id=$1
     ORDER BY s.row_label, s.seat_number`,
    [req.params.id]
  );
  res.json(result.rows);
}));

export default router;
