/**
 * Seed script — creates realistic demo data for all 16 event types.
 * Run: npm run seed
 *
 * Creates:
 * - 1 Admin user
 * - 1 Organiser user
 * - 5 Customers
 * - 3 Venues (Mumbai, Delhi, Bangalore)
 * - 16 events (one of every type)
 * - 2 shows per event (published)
 * - Per-category pricing set on all shows
 */

import { seedDatabase } from './src/db/seed';

seedDatabase(true)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
