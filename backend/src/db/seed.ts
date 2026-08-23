/**
 * Seed script — creates realistic demo data for all 16 event types.
 */

import bcrypt from 'bcryptjs';
import { pool } from './pool';

const BCRYPT_ROUNDS = 4; // Fast for seeding

export async function seedDatabase(shouldEndPool = false) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding demo data...');

    // ── 1. Users ──────────────────────────────────────────────────────────────
    const pwHash = await bcrypt.hash('Demo@12345', BCRYPT_ROUNDS);

    const adminRes = await client.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
       VALUES('Admin User', 'admin@ticketbook.demo', '+91-9000000001', $1, 'admin', true)
       ON CONFLICT(email) DO UPDATE SET password_hash=$1, email_verified=true
       RETURNING id`,
      [pwHash]
    );
    console.log('  ✓ Admin: admin@ticketbook.demo / Demo@12345');

    const orgRes = await client.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
       VALUES('Rahul Mehta', 'organiser@ticketbook.demo', '+91-9000000002', $1, 'organiser', true)
       ON CONFLICT(email) DO UPDATE SET password_hash=$1, email_verified=true
       RETURNING id`,
      [pwHash]
    );
    console.log('  ✓ Organiser: organiser@ticketbook.demo / Demo@12345');

    const customers = [
      ['Priya Sharma', 'customer1@ticketbook.demo', '+91-9111111111'],
      ['Arjun Patel', 'customer2@ticketbook.demo', '+91-9222222222'],
      ['Ananya Rao', 'customer3@ticketbook.demo', '+91-9333333333'],
      ['Kiran Verma', 'customer4@ticketbook.demo', '+91-9444444444'],
      ['Sneha Iyer', 'customer5@ticketbook.demo', '+91-9555555555'],
    ];
    for (const [name, email, phone] of customers) {
      await client.query(
        `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
         VALUES($1,$2,$3,$4,'customer', true)
         ON CONFLICT(email) DO UPDATE SET password_hash=$4, email_verified=true`,
        [name, email, phone, pwHash]
      );
    }
    console.log('  ✓ 5 customers seeded (customer1–5@ticketbook.demo / Demo@12345)');

    // ── 2. Venues ─────────────────────────────────────────────────────────────
    const venueData = [
      { name: 'Wankhede Stadium', address: 'D Rd, Churchgate', city: 'Mumbai' },
      { name: 'PVR Phoenix Palladium', address: '462, Senapati Bapat Marg, Lower Parel', city: 'Mumbai' },
      { name: 'Jawaharlal Nehru Stadium', address: 'Lodhi Rd', city: 'New Delhi' },
      { name: 'INOX Lido', address: '7, Infantry Rd, Tasker Town', city: 'Bengaluru' },
    ];

    const venueIds: Record<string, string> = {};
    for (const v of venueData) {
      const res = await client.query(
        `INSERT INTO venues(name, address, city, created_by)
         VALUES($1,$2,$3,$4)
         ON CONFLICT DO NOTHING RETURNING id`,
        [v.name, v.address, v.city, adminRes.rows[0].id]
      );
      const id = res.rows[0]?.id ?? (
        await client.query(`SELECT id FROM venues WHERE name=$1`, [v.name])
      ).rows[0].id;
      venueIds[v.name] = id;
    }
    console.log(`  ✓ ${venueData.length} venues seeded`);

    // ── 3. Seat categories per venue ──────────────────────────────────────────
    const categoryMap: Record<string, Record<string, string>> = {};

    for (const [, venueId] of Object.entries(venueIds)) {
      const cats = [
        { name: 'Premium', color_hex: '#7c3aed', display_order: 0, price: 1500 },
        { name: 'Standard', color_hex: '#2563eb', display_order: 1, price: 800 },
        { name: 'Economy', color_hex: '#16a34a', display_order: 2, price: 400 },
      ];
      categoryMap[venueId] = {};
      for (const cat of cats) {
        const res = await client.query(
          `INSERT INTO seat_categories(venue_id, name, color_hex, display_order)
           VALUES($1,$2,$3,$4)
           ON CONFLICT DO NOTHING RETURNING id`,
          [venueId, cat.name, cat.color_hex, cat.display_order]
        );
        const catId = res.rows[0]?.id ?? (
          await client.query(`SELECT id FROM seat_categories WHERE venue_id=$1 AND name=$2`, [venueId, cat.name])
        ).rows[0].id;
        categoryMap[venueId][cat.name] = catId;
        // Store price on category obj for later
        (cat as typeof cat & { id: string }).id = catId;
      }
    }

    // ── 4. Seats per venue ────────────────────────────────────────────────────
    for (const [, venueId] of Object.entries(venueIds)) {
      const existingSeats = await client.query(`SELECT COUNT(*) as cnt FROM seats WHERE venue_id=$1`, [venueId]);
      if (parseInt(existingSeats.rows[0].cnt) > 0) continue;

      const cats = categoryMap[venueId];
      const premiumId = cats['Premium'];
      const standardId = cats['Standard'];
      const economyId = cats['Economy'];

      // Layout: rows A-C Premium (15/row), D-J Standard (20/row), K-O Economy (25/row)
      const layout = [
        { rows: ['A', 'B', 'C'], seatsPerRow: 15, catId: premiumId },
        { rows: ['D', 'E', 'F', 'G', 'H', 'I', 'J'], seatsPerRow: 20, catId: standardId },
        { rows: ['K', 'L', 'M', 'N', 'O'], seatsPerRow: 25, catId: economyId },
      ];

      const values: any[] = [];
      const valuePlaceholders: string[] = [];
      let paramIndex = 1;

      for (const { rows, seatsPerRow, catId } of layout) {
        for (const row of rows) {
          for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
            values.push(venueId, catId, row, seatNum);
            valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          }
        }
      }

      if (values.length > 0) {
        await client.query(
          `INSERT INTO seats(venue_id, category_id, row_label, seat_number)
           VALUES ${valuePlaceholders.join(', ')}
           ON CONFLICT DO NOTHING`,
          values
        );
      }
    }
    console.log('  ✓ Seats generated for all venues');

    // ── 5. Events ─────────────────────────────────────────────────────────────
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const organsierId = orgRes.rows[0].id;

    const eventData = [
      { title: 'Sholay — The Return (4K Remaster)', type: 'movie', venueKey: 'PVR Phoenix Palladium', description: 'The classic 1975 Bollywood masterpiece in stunning 4K restoration with Dolby Atmos sound.' },
      { title: 'Arijit Singh Live in Concert', type: 'concert', venueKey: 'Wankhede Stadium', description: 'Arijit Singh brings his soulful voice to Mumbai for one unforgettable night.' },
      { title: 'Hamlet — Prithvi Theatre Production', type: 'play', venueKey: 'PVR Phoenix Palladium', description: 'Shakespeare\'s timeless tragedy reimagined in contemporary India.' },
      { title: 'Mughal-E-Azam Musical', type: 'musical', venueKey: 'Jawaharlal Nehru Stadium', description: 'The iconic Bollywood film brought to life as a grand musical stage production.' },
      { title: 'A.R. Rahman: Roja Opera Nuit', type: 'opera', venueKey: 'INOX Lido', description: 'A.R. Rahman\'s Roja score performed as a full orchestral opera experience.' },
      { title: 'Shiamak Davar\'s Dance Spectacular', type: 'dance', venueKey: 'Wankhede Stadium', description: 'Bollywood\'s most celebrated choreographer presents his annual dance showcase.' },
      { title: 'Zakir Khan: Sakht Launda Returns', type: 'standup', venueKey: 'PVR Phoenix Palladium', description: 'The bhai of Indore is back with brand-new material about life, love, and dosa.' },
      { title: 'India vs Australia T20I', type: 'sports', venueKey: 'Wankhede Stadium', description: 'High-octane T20 International cricket action at the iconic Wankhede.' },
      { title: 'ESL One India Dota 2 Championship', type: 'esports', venueKey: 'INOX Lido', description: 'India\'s biggest Dota 2 tournament with teams from across South Asia.' },
      { title: 'Lollapalooza India 2026', type: 'festival', venueKey: 'Wankhede Stadium', description: 'Three-day multi-genre music festival featuring 50+ artists.' },
      { title: 'India Art Fair 2026', type: 'exhibition', venueKey: 'Jawaharlal Nehru Stadium', description: 'South Asia\'s premier modern and contemporary art fair.' },
      { title: 'TechSpark India Summit', type: 'conference', venueKey: 'INOX Lido', description: 'India\'s leading technology conference with 200+ speakers and 10,000 attendees.' },
      { title: 'Photography Masterclass with Raghu Rai', type: 'workshop', venueKey: 'PVR Phoenix Palladium', description: 'Legendary photographer Raghu Rai shares five decades of storytelling in a one-day immersive workshop.' },
      { title: 'Grand Illusions — The Magic Show', type: 'magic', venueKey: 'INOX Lido', description: 'An evening of impossible illusions, close-up magic, and mind-bending mentalism.' },
      { title: 'Cirque du Soleil: Alegría', type: 'circus', venueKey: 'Jawaharlal Nehru Stadium', description: 'The world-famous acrobatic circus experience comes to India for the first time.' },
      { title: 'IPL Opening Ceremony 2026', type: 'other', venueKey: 'Wankhede Stadium', description: 'Kick off IPL 2026 with live performances, fireworks, and cricket royalty.' },
    ];

    const eventIds: string[] = [];
    for (let i = 0; i < eventData.length; i++) {
      const e = eventData[i];
      const venueId = Object.entries(venueIds).find(([k]) => k === e.venueKey)?.[1] ?? Object.values(venueIds)[0];
      const res = await client.query(
        `INSERT INTO events(organiser_id, venue_id, title, description, type)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [organsierId, venueId, e.title, e.description, e.type]
      );
      const id = res.rows[0]?.id ?? (
        await client.query(`SELECT id FROM events WHERE title=$1`, [e.title])
      ).rows[0].id;
      eventIds.push(id);
    }
    console.log(`  ✓ ${eventData.length} events seeded (all 16 types)`);

    // ── 6. Shows ──────────────────────────────────────────────────────────────
    for (let i = 0; i < eventData.length; i++) {
      const eventId = eventIds[i];
      const venueId = Object.entries(venueIds).find(([k]) => k === eventData[i].venueKey)?.[1] ?? Object.values(venueIds)[0];
      const cats = categoryMap[venueId];

      const showDates = [
        { starts: new Date(now.getTime() + (i + 3) * day), ends: new Date(now.getTime() + (i + 3) * day + 3 * 60 * 60 * 1000) },
        { starts: new Date(now.getTime() + (i + 10) * day), ends: new Date(now.getTime() + (i + 10) * day + 3 * 60 * 60 * 1000) },
      ];

      for (const dates of showDates) {
        // Check if show already exists
        const existingShow = await client.query(
          `SELECT id FROM shows WHERE event_id=$1 AND starts_at=$2`, [eventId, dates.starts]
        );
        if (existingShow.rows.length > 0) continue;

        const showRes = await client.query(
          `INSERT INTO shows(event_id, starts_at, ends_at, status)
           VALUES($1,$2,$3,'published') RETURNING id`,
          [eventId, dates.starts, dates.ends]
        );
        const showId = showRes.rows[0].id;

        // Populate show_seats
        await client.query(
          `INSERT INTO show_seats(show_id, seat_id, status)
           SELECT $1, id, 'available' FROM seats WHERE venue_id=$2
           ON CONFLICT DO NOTHING`,
          [showId, venueId]
        );

        // Populate realistic demo seat statuses (Booked, Held by others, Held by Priya)
        const userRows = (await client.query(`SELECT id, email FROM users`)).rows;
        const cust1 = userRows.find(u => u.email === 'customer1@ticketbook.demo')?.id;
        const cust2 = userRows.find(u => u.email === 'customer2@ticketbook.demo')?.id;

        // 1. Booked seats
        const bookedSeats = await client.query(
          `SELECT ss.id FROM show_seats ss
           JOIN seats s ON s.id = ss.seat_id
           WHERE ss.show_id = $1 AND (
             (s.row_label = 'L' AND s.seat_number IN (19, 20)) OR
             (s.row_label = 'M' AND s.seat_number = 20) OR
             (s.row_label = 'N' AND s.seat_number = 22) OR
             (s.row_label = 'O' AND s.seat_number = 24)
           )`,
          [showId]
        );
        if (bookedSeats.rows.length > 0) {
          const ids = bookedSeats.rows.map(r => r.id);
          await client.query(
            `UPDATE show_seats SET status = 'booked' WHERE id = ANY($1::uuid[])`,
            [ids]
          );
        }

        // 2. Held by other users
        if (cust2) {
          const otherHeld = await client.query(
            `SELECT ss.id FROM show_seats ss
             JOIN seats s ON s.id = ss.seat_id
             WHERE ss.show_id = $1 AND s.row_label = 'E' AND s.seat_number IN (11, 12)`,
            [showId]
          );
          if (otherHeld.rows.length > 0) {
            const ids = otherHeld.rows.map(r => r.id);
            await client.query(
              `UPDATE show_seats SET status = 'held' WHERE id = ANY($1::uuid[])`,
              [ids]
            );
            for (const row of otherHeld.rows) {
              await client.query(
                `INSERT INTO holds(show_seat_id, customer_id, expires_at)
                 VALUES($1, $2, now() + interval '10 minutes')
                 ON CONFLICT (show_seat_id) DO UPDATE SET expires_at = now() + interval '10 minutes'`,
                [row.id, cust2]
              );
            }
          }
        }

        // 3. Held by current user (Priya) -> "Your Hold"
        if (cust1) {
          const myHeld = await client.query(
            `SELECT ss.id FROM show_seats ss
             JOIN seats s ON s.id = ss.seat_id
             WHERE ss.show_id = $1 AND (
               (s.row_label = 'F' AND s.seat_number IN (8, 9)) OR
               (s.row_label = 'K' AND s.seat_number IN (12, 13, 14))
             )`,
            [showId]
          );
          if (myHeld.rows.length > 0) {
            const ids = myHeld.rows.map(r => r.id);
            await client.query(
              `UPDATE show_seats SET status = 'held' WHERE id = ANY($1::uuid[])`,
              [ids]
            );
            for (const row of myHeld.rows) {
              await client.query(
                `INSERT INTO holds(show_seat_id, customer_id, expires_at)
                 VALUES($1, $2, now() + interval '10 minutes')
                 ON CONFLICT (show_seat_id) DO UPDATE SET expires_at = now() + interval '10 minutes'`,
                [row.id, cust1]
              );
            }
          }
        }

        // Set pricing
        const prices = [
          { name: 'Premium', price: 1500 + i * 100 },
          { name: 'Standard', price: 800 + i * 50 },
          { name: 'Economy', price: 400 + i * 25 },
        ];
        for (const p of prices) {
          const catId = cats[p.name];
          if (catId) {
            await client.query(
              `INSERT INTO show_seat_prices(show_id, category_id, price)
               VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
              [showId, catId, p.price]
            );
          }
        }
      }
    }
    console.log('  ✓ Shows, pricing, and demo seat statuses seeded (Booked, Held, Your Hold)');

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!');
    console.log('\nDemo credentials (all passwords: Demo@12345):');
    console.log('  Admin:    admin@ticketbook.demo');
    console.log('  Organiser: organiser@ticketbook.demo');
    console.log('  Customer:  customer1@ticketbook.demo (through customer5)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    if (shouldEndPool) {
      await pool.end();
    }
  }
}
