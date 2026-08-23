import cron from 'node-cron';
import { pool } from '../db/pool';
import { redis } from '../redis/client';
import { getIO } from '../socket';
import { showRoom, holdRedisKey } from '../config/constants';

/**
 * Fallback cron for expired holds.
 *
 * Purpose: Safety net for Redis restarts or missed keyspace notifications.
 * Runs every 60 seconds. Finds holds where expires_at < now() that weren't
 * released by the keyspace subscriber, and releases them.
 *
 * This is idempotent — if the keyspace subscriber already released the hold,
 * the cron will find no rows and do nothing.
 */
interface ExpiredHoldRow {
  id: string;
  show_seat_id: string;
  waitlist_offer_id: string | null;
  show_id: string;
}

export function startExpiredHoldsCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const expired = await client.query<ExpiredHoldRow>(
          `SELECT h.id, h.show_seat_id, h.waitlist_offer_id, ss.show_id
           FROM holds h
           JOIN show_seats ss ON ss.id = h.show_seat_id
           WHERE h.expires_at < now() AND ss.status = 'held'
           FOR UPDATE SKIP LOCKED
           LIMIT 100`,
          []
        );

        if (expired.rows.length === 0) {
          await client.query('ROLLBACK');
          return;
        }

        for (const hold of expired.rows) {
          await client.query(
            `UPDATE show_seats SET status = 'available' WHERE id = $1`,
            [hold.show_seat_id]
          );
          await client.query(`DELETE FROM holds WHERE id = $1`, [hold.id]);

          if (hold.waitlist_offer_id) {
            await client.query(
              `UPDATE waitlist_offers SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
              [hold.waitlist_offer_id]
            );
            await client.query(
              `UPDATE waitlist_entries SET status = 'expired'
               WHERE id = (SELECT entry_id FROM waitlist_offers WHERE id = $1)
               AND status = 'offered'`,
              [hold.waitlist_offer_id]
            );
          }
        }

        await client.query('COMMIT');

        // Broadcast releases & trigger waitlist cascades
        const io = getIO();
        const { waitlistService } = await import('../services/waitlistService');
        for (const hold of expired.rows) {
          io.to(showRoom(hold.show_id)).emit('seat:update', {
            showId: hold.show_id,
            showSeatId: hold.show_seat_id,
            status: 'available',
          });
          // Clean up stale Redis keys
          await redis.del(holdRedisKey(hold.show_seat_id));

          if (hold.waitlist_offer_id) {
            await waitlistService.onHoldExpired(hold.show_seat_id).catch((err: unknown) => {
              console.error(`[cron] Error cascading waitlist for seat ${hold.show_seat_id}:`, err);
            });
          }
        }

        console.log(`[cron] Released ${expired.rows.length} expired hold(s)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[cron] Error releasing expired holds:', err);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[cron] DB connection error:', err);
    }
  });

  console.log('✅ Expired holds fallback cron started (every 60s)');
}
