import { redisSub } from './client';
import { pool } from '../db/pool';
import { getIO } from '../socket';
import { showRoom } from '../config/constants';

/**
 * Redis Keyspace Notification Subscriber
 *
 * Listens for `__keyevent@0__:expired` events on keys matching `hold:*`.
 * When a hold key expires in Redis, we:
 *   1. Look up the hold in Postgres by show_seat_id (extracted from key).
 *   2. If the hold still exists and has not been converted to a booking:
 *      a. Delete the hold row.
 *      b. Set show_seats.status = 'available'.
 *      c. If it was a waitlist offer hold, mark the offer as 'expired' and
 *         trigger the next waitlist cascade.
 *   3. Broadcast seat:update to the Socket.io room for that show.
 *
 * This is event-driven — no polling lag. The fallback cron (expiredHoldsCron)
 * handles any events missed during Redis restarts.
 */

let waitlistServiceRef: { onHoldExpired: (showSeatId: string) => Promise<void> } | null = null;

export function setWaitlistServiceRef(svc: typeof waitlistServiceRef) {
  waitlistServiceRef = svc;
}

export function startKeyspaceSubscriber() {
  // Subscribe to expired key events on all keys
  redisSub.subscribe('__keyevent@0__:expired', (err: Error | null | undefined) => {
    if (err) {
      console.error('Failed to subscribe to keyspace notifications:', err);
      return;
    }
    console.log('✅ Redis keyspace subscriber active');
  });

  redisSub.on('message', async (channel: string, key: string) => {
    if (channel !== '__keyevent@0__:expired') return;

    // Only handle hold keys
    if (!key.startsWith('hold:')) return;

    const showSeatId = key.replace('hold:', '');
    console.log(`[keyspace] Hold expired for show_seat_id=${showSeatId}`);

    await releaseExpiredHold(showSeatId);
  });
}

interface ExpiredHoldRecord {
  id: string;
  customer_id: string;
  waitlist_offer_id: string | null;
  show_id: string;
  seat_status: string;
}

export async function releaseExpiredHold(showSeatId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch the hold (may already be deleted if booking was confirmed)
    const holdRes = await client.query<ExpiredHoldRecord>(
      `SELECT h.id, h.customer_id, h.waitlist_offer_id,
              ss.show_id, ss.status as seat_status
       FROM holds h
       JOIN show_seats ss ON ss.id = h.show_seat_id
       WHERE h.show_seat_id = $1
       FOR UPDATE`,
      [showSeatId]
    );

    if (holdRes.rows.length === 0) {
      // Hold already cleaned up (booking confirmed or manually released)
      await client.query('ROLLBACK');
      return;
    }

    const hold = holdRes.rows[0];

    if (hold.seat_status === 'booked') {
      // Seat was booked before Redis key expired — nothing to do
      await client.query('ROLLBACK');
      return;
    }

    // Release: set seat back to available, delete hold
    await client.query(
      `UPDATE show_seats SET status = 'available' WHERE id = $1`,
      [showSeatId]
    );
    await client.query(`DELETE FROM holds WHERE show_seat_id = $1`, [showSeatId]);

    // If this was a waitlist offer hold, mark the offer as expired
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

    await client.query('COMMIT');

    // Broadcast seat update to all clients viewing this show
    const io = getIO();
    io.to(showRoom(hold.show_id)).emit('seat:update', {
      showId: hold.show_id,
      showSeatId,
      status: 'available',
    });

    console.log(`[keyspace] Hold released for show_seat_id=${showSeatId}`);

    // Trigger waitlist cascade if it was an offer hold
    if (hold.waitlist_offer_id && waitlistServiceRef) {
      // Get category_id for this show_seat
      const catRes = await pool.query(
        `SELECT s.category_id FROM show_seats ss
         JOIN seats s ON s.id = ss.seat_id
         WHERE ss.id = $1`,
        [showSeatId]
      );
      if (catRes.rows.length > 0) {
        await waitlistServiceRef.onHoldExpired(showSeatId).catch((err) => {
          console.error('[keyspace] Waitlist cascade error:', err);
        });
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[keyspace] Error releasing expired hold:', err);
  } finally {
    client.release();
  }
}
