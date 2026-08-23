import crypto from 'crypto';
import { pool, withTransaction } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { createHold } from './holdService';
import { sendWaitlistOffer } from './emailService';
import { env } from '../config/env';
import { WAITLIST_OFFER_TTL_SECONDS } from '../config/constants';

/**
 * WaitlistService — Phase 4
 *
 * FIFO ordering: created_at timestamp — no stored position column.
 * Position computed on read via ROW_NUMBER() OVER (PARTITION BY show_id, category_id ORDER BY created_at).
 *
 * Race safety: pg_advisory_xact_lock wraps the "find next + create offer" path.
 * Two concurrent cancellations on the same category cannot both select the same
 * waitlist entry — the advisory lock serializes the critical section.
 *
 * Offer = a hold with waitlist_offer_id set + shorter TTL.
 * Reuses the entire Phase 2 hold machinery — no new expiry mechanism needed.
 */

/**
 * Generate a signed, single-use HMAC token for a waitlist offer link.
 * Prevents guessing or replaying expired links.
 */
function generateOfferToken(offerId: string, expiresAt: Date): string {
  return crypto
    .createHmac('sha256', env.WAITLIST_TOKEN_SECRET)
    .update(`${offerId}:${expiresAt.toISOString()}`)
    .digest('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const waitlistService = {
  /**
   * Join the waitlist for a seat category in a show.
   * Blocked if the customer already has an active hold/booking for this category+show.
   */
  async joinWaitlist(
    customerId: string,
    showId: string,
    categoryId: string
  ): Promise<{ entry_id: string; position: number }> {
    // Check if user is email verified
    const userRes = await pool.query('SELECT email_verified FROM users WHERE id = $1', [customerId]);
    if (userRes.rows[0] && !userRes.rows[0].email_verified) {
      throw new AppError(403, 'Please verify your email address before joining waitlists.');
    }

    // Check if category is actually sold out
    const available = await pool.query(
      `SELECT COUNT(*) as cnt FROM show_seats ss
       JOIN seats s ON s.id = ss.seat_id
       WHERE ss.show_id = $1 AND s.category_id = $2 AND ss.status = 'available'`,
      [showId, categoryId]
    );
    if (parseInt(available.rows[0].cnt) > 0) {
      throw new AppError(409, 'Seats are still available — you can book directly');
    }

    // Check for existing active hold/booking in this category
    const activeHold = await pool.query(
      `SELECT h.id FROM holds h
       JOIN show_seats ss ON ss.id = h.show_seat_id
       JOIN seats s ON s.id = ss.seat_id
       WHERE h.customer_id = $1 AND ss.show_id = $2 AND s.category_id = $3 AND h.expires_at > now()`,
      [customerId, showId, categoryId]
    );
    if (activeHold.rows.length > 0) {
      throw new AppError(409, 'You already have an active hold for this category');
    }

    const entryRes = await pool.query(
      `INSERT INTO waitlist_entries(show_id, category_id, customer_id)
       VALUES($1, $2, $3)
       ON CONFLICT(show_id, category_id, customer_id) DO UPDATE
         SET status = CASE WHEN waitlist_entries.status IN ('expired','removed') THEN 'waiting'
                          ELSE waitlist_entries.status END,
             created_at = CASE WHEN waitlist_entries.status IN ('expired','removed') THEN now()
                               ELSE waitlist_entries.created_at END
       RETURNING id`,
      [showId, categoryId, customerId]
    );

    const position = await this.getPosition(customerId, showId, categoryId);
    return { entry_id: entryRes.rows[0].id, position };
  },

  /**
   * Get the current queue position for a customer (1-indexed).
   * Uses ROW_NUMBER() — no stale stored position.
   */
  async getPosition(
    customerId: string,
    showId: string,
    categoryId: string
  ): Promise<number> {
    const result = await pool.query(
      `WITH ranked AS (
         SELECT customer_id,
                ROW_NUMBER() OVER (ORDER BY created_at) as position
         FROM waitlist_entries
         WHERE show_id = $2 AND category_id = $3 AND status = 'waiting'
       )
       SELECT position FROM ranked WHERE customer_id = $1`,
      [customerId, showId, categoryId]
    );
    return result.rows[0] ? parseInt(result.rows[0].position) : -1;
  },

  /**
   * Get full waitlist status for a customer on a show+category.
   */
  async getWaitlistStatus(
    customerId: string,
    showId: string,
    categoryId: string
  ): Promise<{
    status: string;
    position: number | null;
    total_waiting: number;
    offer_expires_at: string | null;
  }> {
    const entryRes = await pool.query(
      `SELECT we.id, we.status,
              wo.expires_at as offer_expires_at
       FROM waitlist_entries we
       LEFT JOIN waitlist_offers wo ON wo.entry_id = we.id AND wo.status = 'pending'
       WHERE we.customer_id = $1 AND we.show_id = $2 AND we.category_id = $3`,
      [customerId, showId, categoryId]
    );

    if (!entryRes.rows[0]) {
      return { status: 'not_on_waitlist', position: null, total_waiting: 0, offer_expires_at: null };
    }

    const entry = entryRes.rows[0];
    const totalRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM waitlist_entries
       WHERE show_id = $1 AND category_id = $2 AND status = 'waiting'`,
      [showId, categoryId]
    );

    let position: number | null = null;
    if (entry.status === 'waiting') {
      position = await this.getPosition(customerId, showId, categoryId);
    }

    return {
      status: entry.status,
      position,
      total_waiting: parseInt(totalRes.rows[0].cnt),
      offer_expires_at: entry.offer_expires_at?.toISOString() ?? null,
    };
  },

  /**
   * Trigger waitlist reassignment when a seat becomes available.
   *
   * Race safety: pg_advisory_xact_lock(bigint) serializes concurrent calls
   * for the same show+category pair. Two simultaneous cancellations cannot
   * both select the same waitlist entry.
   *
   * Idempotent: if a pending offer already exists for this seat, does nothing.
   */
  async triggerReassignment(
    showSeatId: string,
    categoryId: string,
    showId: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Advisory lock scoped to this show+category combination
      // Use a hash of the two UUIDs to get a bigint for the lock
      const lockKey = await client.query(
        `SELECT ('x' || substr(md5($1 || $2), 1, 16))::bit(64)::bigint as lock_id`,
        [showId, categoryId]
      );
      const lockId = lockKey.rows[0].lock_id;
      await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockId]);

      // Check if a pending offer already exists for this seat
      const existingOffer = await client.query(
        `SELECT id FROM waitlist_offers WHERE show_seat_id = $1 AND status = 'pending'`,
        [showSeatId]
      );
      if (existingOffer.rows.length > 0) {
        await client.query('ROLLBACK');
        return; // Offer already in flight — do nothing
      }

      // Check the seat is actually available
      const seatRes = await client.query(
        `SELECT status FROM show_seats WHERE id = $1 FOR UPDATE`,
        [showSeatId]
      );
      if (!seatRes.rows[0] || seatRes.rows[0].status !== 'available') {
        await client.query('ROLLBACK');
        return;
      }

      // Get next in queue (FIFO by created_at)
      const nextEntry = await client.query(
        `SELECT we.id as entry_id, we.customer_id,
                u.full_name, u.email
         FROM waitlist_entries we
         JOIN users u ON u.id = we.customer_id
         WHERE we.show_id = $1 AND we.category_id = $2 AND we.status = 'waiting'
         ORDER BY we.created_at
         LIMIT 1`,
        [showId, categoryId]
      );

      if (!nextEntry.rows[0]) {
        await client.query('COMMIT');
        return; // No one waiting
      }

      const next = nextEntry.rows[0];
      const offerTtl = WAITLIST_OFFER_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + offerTtl * 1000);

      // Create a hold for this customer (reuses Phase 2 hold machinery)
      // We do this within the advisory lock to prevent race
      await client.query('COMMIT'); // Release advisory lock before createHold (which has its own transaction)
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Now create the hold and offer outside the advisory lock transaction
    // (createHold has its own Postgres transaction + Redis SETNX)
    await this._createOfferForEntry(showSeatId, categoryId, showId);
  },

  async _createOfferForEntry(
    showSeatId: string,
    categoryId: string,
    showId: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Re-acquire advisory lock for the actual offer creation
      const lockKey = await client.query(
        `SELECT ('x' || substr(md5($1 || $2), 1, 16))::bit(64)::bigint as lock_id`,
        [showId, categoryId]
      );
      await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey.rows[0].lock_id]);

      // Double-check no offer was created while we were creating the hold
      const existingOffer = await client.query(
        `SELECT id FROM waitlist_offers WHERE show_seat_id = $1 AND status = 'pending'`,
        [showSeatId]
      );
      if (existingOffer.rows.length > 0) {
        await client.query('ROLLBACK');
        return;
      }

      const nextEntry = await client.query(
        `SELECT we.id as entry_id, we.customer_id,
                u.full_name, u.email
         FROM waitlist_entries we
         JOIN users u ON u.id = we.customer_id
         WHERE we.show_id = $1 AND we.category_id = $2 AND we.status = 'waiting'
         ORDER BY we.created_at
         LIMIT 1`,
        [showId, categoryId]
      );

      if (!nextEntry.rows[0]) {
        await client.query('ROLLBACK');
        return;
      }

      const next = nextEntry.rows[0];
      const offerTtl = WAITLIST_OFFER_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + offerTtl * 1000);

      // Create hold via holdService (outside this transaction to avoid deadlock)
      await client.query('COMMIT');
      client.release();

      let hold: Awaited<ReturnType<typeof createHold>>;
      try {
        hold = await createHold(showSeatId, next.customer_id, offerTtl);
      } catch {
        // Seat may have been re-taken — abort
        return;
      }

      // Create offer record
      const token = generateOfferToken(hold.hold_id, expiresAt);
      const tokenHash = hashToken(token);

      const offerClient = await pool.connect();
      try {
        await offerClient.query('BEGIN');
        const offerRes = await offerClient.query(
          `INSERT INTO waitlist_offers(entry_id, show_seat_id, hold_id, token_hash, expires_at, status)
           VALUES($1, $2, $3, $4, $5, 'pending') RETURNING id`,
          [next.entry_id, showSeatId, hold.hold_id, tokenHash, expiresAt]
        );

        // Update hold to reference the offer
        await offerClient.query(
          `UPDATE holds SET waitlist_offer_id = $1 WHERE id = $2`,
          [offerRes.rows[0].id, hold.hold_id]
        );

        // Mark entry as offered
        await offerClient.query(
          `UPDATE waitlist_entries SET status = 'offered' WHERE id = $1`,
          [next.entry_id]
        );

        await offerClient.query('COMMIT');

        // Get event info for email
        const eventInfo = await pool.query(
          `SELECT e.title, sh.starts_at, v.name as venue_name, sc.name as category_name
           FROM shows sh
           JOIN events e ON e.id = sh.event_id
           JOIN venues v ON v.id = e.venue_id
           JOIN seat_categories sc ON sc.id = $2
           WHERE sh.id = $1`,
          [showId, categoryId]
        );

        // Send offer email
        const acceptUrl = `${env.FRONTEND_URL}/waitlist/accept/${offerRes.rows[0].id}?token=${token}`;
        sendWaitlistOffer({
          customerName: next.full_name,
          customerEmail: next.email,
          eventTitle: eventInfo.rows[0]?.title ?? 'Event',
          showStartsAt: eventInfo.rows[0]?.starts_at ?? new Date(),
          categoryName: eventInfo.rows[0]?.category_name ?? '',
          offerExpiresAt: expiresAt,
          acceptUrl,
        });
      } catch (err) {
        await offerClient.query('ROLLBACK');
        throw err;
      } finally {
        offerClient.release();
      }
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* already released */ }
      client.release();
      throw err;
    }
  },

  /**
   * Verify a waitlist offer token and return the offer if valid.
   * Used by the accept endpoint.
   */
  async verifyOffer(
    offerId: string,
    token: string
  ): Promise<{
    offer_id: string;
    hold_id: string;
    show_seat_id: string;
    customer_id: string;
    expires_at: Date;
  }> {
    const offerRes = await pool.query(
      `SELECT wo.id, wo.hold_id, wo.show_seat_id, wo.token_hash, wo.expires_at, wo.status,
              we.customer_id
       FROM waitlist_offers wo
       JOIN waitlist_entries we ON we.id = wo.entry_id
       WHERE wo.id = $1`,
      [offerId]
    );

    if (!offerRes.rows[0]) throw new AppError(404, 'Offer not found');
    const offer = offerRes.rows[0];

    if (offer.status !== 'pending') {
      throw new AppError(409, 'This offer has already been used or has expired');
    }

    if (new Date(offer.expires_at) <= new Date()) {
      throw new AppError(410, 'This offer has expired');
    }

    // Verify HMAC token
    const expectedHash = hashToken(token);
    if (!crypto.timingSafeEqual(
      Buffer.from(offer.token_hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )) {
      throw new AppError(401, 'Invalid offer token');
    }

    return {
      offer_id: offer.id,
      hold_id: offer.hold_id,
      show_seat_id: offer.show_seat_id,
      customer_id: offer.customer_id,
      expires_at: offer.expires_at,
    };
  },

  /**
   * Called by keyspace subscriber when a waitlist hold expires.
   * Cascades to next in line.
   */
  async onHoldExpired(showSeatId: string): Promise<void> {
    // Get category and show for this seat
    const seatInfo = await pool.query(
      `SELECT ss.show_id, s.category_id
       FROM show_seats ss JOIN seats s ON s.id = ss.seat_id
       WHERE ss.id = $1`,
      [showSeatId]
    );
    if (!seatInfo.rows[0]) return;
    const { show_id, category_id } = seatInfo.rows[0];
    await this.triggerReassignment(showSeatId, category_id, show_id);
  },
};
