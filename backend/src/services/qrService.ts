import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';
import { pool, TxClient } from '../db/pool';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 16);

/**
 * Generate a unique, non-guessable booking reference.
 * Uses nanoid with 62^16 ≈ 4.7×10^28 combinations.
 * Falls back to retry on DB unique constraint collision (astronomically unlikely).
 */
export async function generateBookingRef(txClient?: TxClient): Promise<string> {
  const client = txClient || pool;
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = nanoid();
    const existing = await client.query(`SELECT id FROM orders WHERE booking_ref = $1`, [ref]);
    if (existing.rows.length === 0) return ref;
  }
  throw new Error('Failed to generate unique booking reference after 5 attempts');
}

/**
 * Generate a QR code PNG as a base64 data URL.
 * The QR encodes the booking_ref — staff scan to validate.
 */
export async function generateQRCode(bookingRef: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(bookingRef, {
    errorCorrectionLevel: 'H',
    width: 400,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
  return qrDataUrl;
}
