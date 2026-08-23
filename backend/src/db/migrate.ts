import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { pool } from './pool';

/**
 * Database migration runner.
 * Migrations are defined inline — no external migration library needed.
 * Run: npm run migrate
 * Rollback: npm run migrate:down
 */

const migrations: { id: number; name: string; up: string; down: string }[] = [
  {
    id: 1,
    name: 'create_extensions',
    up: `-- extensions: gen_random_uuid is built-in in modern Postgres & PGlite`,
    down: `-- extensions not dropped`,
  },
  {
    id: 2,
    name: 'create_users',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name     VARCHAR(100) NOT NULL,
        email         VARCHAR(255) UNIQUE NOT NULL,
        phone         VARCHAR(20) NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('admin','organiser','customer')),
        dark_mode_pref BOOLEAN DEFAULT false,
        created_at    TIMESTAMPTZ DEFAULT now(),
        updated_at    TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
    down: `DROP TABLE IF EXISTS users CASCADE;`,
  },
  {
    id: 3,
    name: 'create_venues',
    up: `
      CREATE TABLE IF NOT EXISTS venues (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(200) NOT NULL,
        address     TEXT NOT NULL,
        city        VARCHAR(100) NOT NULL,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        deleted_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT now(),
        updated_at  TIMESTAMPTZ DEFAULT now()
      );
    `,
    down: `DROP TABLE IF EXISTS venues CASCADE;`,
  },
  {
    id: 4,
    name: 'create_seat_categories',
    up: `
      CREATE TABLE IF NOT EXISTS seat_categories (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        name          VARCHAR(100) NOT NULL,
        color_hex     CHAR(7) NOT NULL DEFAULT '#6366f1',
        display_order INT DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT now(),
        updated_at    TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seat_categories_venue ON seat_categories(venue_id);
    `,
    down: `DROP TABLE IF EXISTS seat_categories CASCADE;`,
  },
  {
    id: 5,
    name: 'create_seats',
    up: `
      CREATE TABLE IF NOT EXISTS seats (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
        row_label   VARCHAR(4) NOT NULL,
        seat_number INT NOT NULL,
        is_aisle    BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT now(),
        UNIQUE(venue_id, row_label, seat_number)
      );
      CREATE INDEX IF NOT EXISTS idx_seats_venue ON seats(venue_id);
      CREATE INDEX IF NOT EXISTS idx_seats_category ON seats(category_id);
    `,
    down: `DROP TABLE IF EXISTS seats CASCADE;`,
  },
  {
    id: 6,
    name: 'create_events',
    up: `
      CREATE TABLE IF NOT EXISTS events (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        venue_id     UUID NOT NULL REFERENCES venues(id),
        title        VARCHAR(300) NOT NULL,
        description  TEXT,
        type         TEXT NOT NULL CHECK (type IN (
                       'movie','concert','play','musical','opera','dance',
                       'standup','sports','esports','festival','exhibition',
                       'conference','workshop','magic','circus','other'
                     )),
        poster_url   TEXT,
        created_at   TIMESTAMPTZ DEFAULT now(),
        updated_at   TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_events_organiser ON events(organiser_id);
      CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    `,
    down: `DROP TABLE IF EXISTS events CASCADE;`,
  },
  {
    id: 7,
    name: 'create_shows',
    up: `
      CREATE TABLE IF NOT EXISTS shows (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        starts_at  TIMESTAMPTZ NOT NULL,
        ends_at    TIMESTAMPTZ NOT NULL,
        status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_shows_event ON shows(event_id);
      CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
      CREATE INDEX IF NOT EXISTS idx_shows_starts_at ON shows(starts_at);
    `,
    down: `DROP TABLE IF EXISTS shows CASCADE;`,
  },
  {
    id: 8,
    name: 'create_show_seat_prices',
    up: `
      CREATE TABLE IF NOT EXISTS show_seat_prices (
        show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
        price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        PRIMARY KEY (show_id, category_id)
      );
    `,
    down: `DROP TABLE IF EXISTS show_seat_prices CASCADE;`,
  },
  {
    id: 9,
    name: 'create_show_seats',
    up: `
      CREATE TABLE IF NOT EXISTS show_seats (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id  UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        seat_id  UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
        status   TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','held','booked')),
        UNIQUE(show_id, seat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_show_seats_show ON show_seats(show_id);
      CREATE INDEX IF NOT EXISTS idx_show_seats_status ON show_seats(show_id, status);
    `,
    down: `DROP TABLE IF EXISTS show_seats CASCADE;`,
  },
  {
    id: 10,
    name: 'create_holds',
    up: `
      CREATE TABLE IF NOT EXISTS holds (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_seat_id      UUID NOT NULL UNIQUE REFERENCES show_seats(id) ON DELETE CASCADE,
        customer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at        TIMESTAMPTZ NOT NULL,
        waitlist_offer_id UUID,
        created_at        TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_holds_customer ON holds(customer_id);
      CREATE INDEX IF NOT EXISTS idx_holds_expires ON holds(expires_at);
    `,
    down: `DROP TABLE IF EXISTS holds CASCADE;`,
  },
  {
    id: 11,
    name: 'create_orders',
    up: `
      CREATE TABLE IF NOT EXISTS orders (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        show_id        UUID NOT NULL REFERENCES shows(id),
        booking_ref    VARCHAR(16) UNIQUE NOT NULL,
        total_price    DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
        status         TEXT NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed','partially_cancelled','cancelled')),
        qr_data        TEXT NOT NULL,
        email_sent     BOOLEAN DEFAULT false,
        email_attempts INT DEFAULT 0,
        created_at     TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_show ON orders(show_id);
      CREATE INDEX IF NOT EXISTS idx_orders_booking_ref ON orders(booking_ref);
    `,
    down: `DROP TABLE IF EXISTS orders CASCADE;`,
  },
  {
    id: 12,
    name: 'create_bookings',
    up: `
      CREATE TABLE IF NOT EXISTS bookings (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        show_seat_id UUID NOT NULL REFERENCES show_seats(id),
        customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hold_id      UUID REFERENCES holds(id) ON DELETE SET NULL,
        price        DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
        cancelled_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_order ON bookings(order_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_show_seat ON bookings(show_seat_id);
    `,
    down: `DROP TABLE IF EXISTS bookings CASCADE;`,
  },
  {
    id: 13,
    name: 'create_waitlist_entries',
    up: `
      CREATE TABLE IF NOT EXISTS waitlist_entries (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status      TEXT NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting','offered','fulfilled','expired','removed')),
        created_at  TIMESTAMPTZ DEFAULT now(),
        UNIQUE(show_id, category_id, customer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_waitlist_queue
        ON waitlist_entries(show_id, category_id, status, created_at);
    `,
    down: `DROP TABLE IF EXISTS waitlist_entries CASCADE;`,
  },
  {
    id: 14,
    name: 'create_waitlist_offers',
    up: `
      CREATE TABLE IF NOT EXISTS waitlist_offers (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_id     UUID NOT NULL UNIQUE REFERENCES waitlist_entries(id) ON DELETE CASCADE,
        show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
        hold_id      UUID NOT NULL REFERENCES holds(id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL,
        expires_at   TIMESTAMPTZ NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','expired')),
        created_at   TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_waitlist_offers_show_seat
        ON waitlist_offers(show_seat_id, status);

      -- Add FK from holds back to waitlist_offers (circular FK resolved now both tables exist)
      ALTER TABLE holds ADD CONSTRAINT fk_holds_waitlist_offer
        FOREIGN KEY (waitlist_offer_id) REFERENCES waitlist_offers(id) ON DELETE SET NULL;
    `,
    down: `
      ALTER TABLE holds DROP CONSTRAINT IF EXISTS fk_holds_waitlist_offer;
      DROP TABLE IF EXISTS waitlist_offers CASCADE;
    `,
  },
  {
    id: 15,
    name: 'create_refresh_tokens',
    up: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    `,
    down: `DROP TABLE IF EXISTS refresh_tokens CASCADE;`,
  },
  {
    id: 16,
    name: 'add_email_verification_and_google_oauth',
    up: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

      CREATE TABLE IF NOT EXISTS email_verifications (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token_hash);

      -- Mark seeded demo accounts as verified so dev/testing works out of the box
      UPDATE users SET email_verified = true WHERE email LIKE '%@ticketbook.demo';
    `,
    down: `
      DROP TABLE IF EXISTS email_verifications CASCADE;
      ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
      ALTER TABLE users DROP COLUMN IF EXISTS google_id;
    `,
  },
];

async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INT PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<number[]> {
  const rows = await pool.query<{ id: number }>('SELECT id FROM schema_migrations ORDER BY id');
  return rows.rows.map((r: { id: number }) => r.id);
}

export async function runMigrations(direction: 'up' | 'down' = 'up') {
  await createMigrationsTable();
  const applied = await getAppliedMigrations();

  if (direction === 'up') {
    const pending = migrations.filter((m) => !applied.includes(m.id));
    if (pending.length === 0) {
      console.log('✅ All migrations already applied.');
      return;
    }
    for (const migration of pending) {
      console.log(`⬆  Applying migration ${migration.id}: ${migration.name}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.up);
        await client.query('INSERT INTO schema_migrations(id, name) VALUES($1, $2)', [
          migration.id,
          migration.name,
        ]);
        await client.query('COMMIT');
        console.log(`✅ Migration ${migration.id} applied.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migration.id} failed:`, err);
        throw err;
      } finally {
        client.release();
      }
    }
  } else {
    const toRollback = [...migrations].reverse().filter((m) => applied.includes(m.id)).slice(0, 1);
    for (const migration of toRollback) {
      console.log(`⬇  Rolling back migration ${migration.id}: ${migration.name}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.down);
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [migration.id]);
        await client.query('COMMIT');
        console.log(`✅ Migration ${migration.id} rolled back.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Rollback ${migration.id} failed:`, err);
        throw err;
      } finally {
        client.release();
      }
    }
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith('migrate.ts'))) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  runMigrations(direction)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
