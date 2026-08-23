/**
 * Concurrency Test — Phase 2 Acceptance Criteria
 *
 * Fires N parallel hold requests at the same seat.
 * Asserts EXACTLY ONE succeeds (HTTP 201) and ALL OTHERS fail (HTTP 409).
 * Must pass consistently across repeated runs.
 *
 * This proves the Redis SETNX + Postgres FOR UPDATE mechanism correctly
 * prevents two simultaneous holds on the same seat under concurrency.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { redis } from '../redis/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { initSocket } from '../socket';

// Use a lightweight HTTP request helper to avoid importing axios
function post(url: string, body: object, token?: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parseInt(parsedUrl.port),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode ?? 0, data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

describe('Concurrency Test — Parallel Hold Requests', () => {
  let server: ReturnType<typeof http.createServer>;
  let baseUrl: string;
  let customerToken: string;
  let showSeatId: string;
  let customerId: string;
  const TEST_PARALLELISM = 20;

  beforeAll(async () => {
    // Start server
    const app = createApp();
    server = http.createServer(app);
    initSocket(server);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}/api`;

    // Create test customer
    const hash = await bcrypt.hash('testpass123', 4);
    const userRes = await pool.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
       VALUES('Test Customer', 'concurrency_test@test.com', '9999999999', $1, 'customer', true)
       ON CONFLICT(email) DO UPDATE SET password_hash=$1, email_verified=true
       RETURNING id`,
      [hash]
    );
    customerId = userRes.rows[0].id;
    customerToken = jwt.sign(
      { sub: customerId, email: 'concurrency_test@test.com', role: 'customer', fullName: 'Test Customer' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test venue + category + seat + event + show + show_seat
    const venueRes = await pool.query(
      `INSERT INTO venues(name, address, city) VALUES('Test Venue','123 Street','Mumbai')
       ON CONFLICT DO NOTHING RETURNING id`
    );
    let venueId = venueRes.rows[0]?.id;
    if (!venueId) {
      venueId = (await pool.query(`SELECT id FROM venues WHERE name='Test Venue' LIMIT 1`)).rows[0].id;
    }

    const catRes = await pool.query(
      `INSERT INTO seat_categories(venue_id, name, color_hex)
       VALUES($1, 'Standard', '#6366f1')
       ON CONFLICT DO NOTHING RETURNING id`,
      [venueId]
    );
    let catId = catRes.rows[0]?.id;
    if (!catId) {
      catId = (await pool.query(`SELECT id FROM seat_categories WHERE venue_id=$1 LIMIT 1`, [venueId])).rows[0].id;
    }

    const seatRes = await pool.query(
      `INSERT INTO seats(venue_id, category_id, row_label, seat_number)
       VALUES($1, $2, 'A', 1)
       ON CONFLICT(venue_id, row_label, seat_number) DO UPDATE SET category_id=$2
       RETURNING id`,
      [venueId, catId]
    );
    const seatId = seatRes.rows[0].id;

    // Create organiser + event + show
    const orgHash = await bcrypt.hash('testpass123', 4);
    const orgRes = await pool.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
       VALUES('Test Org','concurrency_org@test.com','8888888888',$1,'organiser', true)
       ON CONFLICT(email) DO UPDATE SET password_hash=$1, email_verified=true RETURNING id`,
      [orgHash]
    );

    const eventRes = await pool.query(
      `INSERT INTO events(organiser_id, venue_id, title, type)
       VALUES($1, $2, 'Concurrency Test Concert', 'concert') RETURNING id`,
      [orgRes.rows[0].id, venueId]
    );

    const showRes = await pool.query(
      `INSERT INTO shows(event_id, starts_at, ends_at, status)
       VALUES($1, now()+interval'1 day', now()+interval'2 days', 'published') RETURNING id`,
      [eventRes.rows[0].id]
    );
    const showId = showRes.rows[0].id;

    // Create show_seat_prices
    await pool.query(
      `INSERT INTO show_seat_prices(show_id, category_id, price) VALUES($1,$2,500)
       ON CONFLICT DO NOTHING`,
      [showId, catId]
    );

    // Create/reset show_seat
    const ssRes = await pool.query(
      `INSERT INTO show_seats(show_id, seat_id, status) VALUES($1,$2,'available')
       ON CONFLICT(show_id, seat_id) DO UPDATE SET status='available' RETURNING id`,
      [showId, seatId]
    );
    showSeatId = ssRes.rows[0].id;

    // Clear any stale holds/redis keys
    await pool.query(`DELETE FROM holds WHERE show_seat_id=$1`, [showSeatId]);
    await redis.del(`hold:${showSeatId}`);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query(`DELETE FROM holds WHERE show_seat_id=$1`, [showSeatId]);
    await pool.query(`UPDATE show_seats SET status='available' WHERE id=$1`, [showSeatId]);
    await redis.del(`hold:${showSeatId}`);
    server.close();
  });

  test(
    `exactly 1 of ${TEST_PARALLELISM} parallel hold requests succeeds`,
    async () => {
      // Reset seat to available
      await pool.query(`DELETE FROM holds WHERE show_seat_id=$1`, [showSeatId]);
      await pool.query(`UPDATE show_seats SET status='available' WHERE id=$1`, [showSeatId]);
      await redis.del(`hold:${showSeatId}`);

      // Fire N parallel requests
      const requests = Array.from({ length: TEST_PARALLELISM }, () =>
        post(`${baseUrl}/customer/holds`, { show_seat_id: showSeatId }, customerToken)
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      console.log(`Results: ${successes.length} success, ${conflicts.length} conflict. All responses:`, responses.map(r => ({ status: r.status, data: r.data })));
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(TEST_PARALLELISM - 1);

      // Verify DB state: exactly one hold row
      const holdCount = await pool.query(
        `SELECT COUNT(*) as cnt FROM holds WHERE show_seat_id=$1`, [showSeatId]
      );
      expect(parseInt(holdCount.rows[0].cnt)).toBe(1);

      // Verify show_seat status
      const seatStatus = await pool.query(
        `SELECT status FROM show_seats WHERE id=$1`, [showSeatId]
      );
      expect(seatStatus.rows[0].status).toBe('held');
    },
    30000
  );

  test('repeating the test gives the same result (consistency check)', async () => {
    // Reset
    await pool.query(`DELETE FROM holds WHERE show_seat_id=$1`, [showSeatId]);
    await pool.query(`UPDATE show_seats SET status='available' WHERE id=$1`, [showSeatId]);
    await redis.del(`hold:${showSeatId}`);

    const requests = Array.from({ length: TEST_PARALLELISM }, () =>
      post(`${baseUrl}/customer/holds`, { show_seat_id: showSeatId }, customerToken)
    );
    const responses = await Promise.all(requests);
    const successes = responses.filter((r) => r.status === 201);
    expect(successes).toHaveLength(1);
  }, 30000);
});
