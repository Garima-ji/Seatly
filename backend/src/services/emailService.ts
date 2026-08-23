import sgMail from '@sendgrid/mail';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { formatIST } from '../config/ist';

sgMail.setApiKey(env.SENDGRID_API_KEY);

/**
 * EmailService — all emails fire-and-forget after DB commit.
 * Failures are logged and retried up to 3 times with exponential backoff.
 * Booking success NEVER depends on email success.
 */

export interface BookingEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  bookingRef: string;
  eventTitle: string;
  showStartsAt: Date;
  venueName: string;
  venueCity: string;
  seats: { row_label: string; seat_number: number; category_name: string; price: number }[];
  totalPrice: number;
  qrDataUrl: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(
  emailFn: () => Promise<unknown>,
  orderId: string,
  maxAttempts = 3
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await emailFn();
      // Mark email as sent
      await pool.query(
        `UPDATE orders SET email_sent = true, email_attempts = $1 WHERE id = $2`,
        [attempt, orderId]
      );
      return;
    } catch (err) {
      lastError = err;
      await pool.query(
        `UPDATE orders SET email_attempts = $1 WHERE id = $2`,
        [attempt, orderId]
      );
      console.error(`[email] Attempt ${attempt} failed for order ${orderId}:`, err);
      if (attempt < maxAttempts) {
        await sleep(1000 * Math.pow(2, attempt)); // exponential backoff
      }
    }
  }
  console.error(`[email] All ${maxAttempts} attempts failed for order ${orderId}:`, lastError);
}

export function sendBookingConfirmation(data: BookingEmailData): void {
  // Fire-and-forget: does NOT return a promise the caller awaits
  setImmediate(() => {
    const base64Data = data.qrDataUrl.split(',')[1];
    sendWithRetry(
      () =>
        sgMail.send({
          from: {
            email: env.EMAIL_FROM,
            name: env.EMAIL_FROM_NAME,
          },
          to: data.customerEmail,
          subject: `Booking Confirmed — ${data.eventTitle} [${data.bookingRef}]`,
          html: buildBookingConfirmationHtml(data),
          attachments: [
            {
              content: base64Data,
              filename: 'ticket-qr.png',
              type: 'image/png',
              disposition: 'inline',
              contentId: 'qrCode',
            },
          ],
        }),
      data.orderId
    );
  });
}

export interface WaitlistOfferEmailData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  showStartsAt: Date;
  categoryName: string;
  offerExpiresAt: Date;
  acceptUrl: string;
}

export function sendWaitlistOffer(data: WaitlistOfferEmailData): void {
  setImmediate(async () => {
    try {
      await sgMail.send({
        from: {
          email: env.EMAIL_FROM,
          name: env.EMAIL_FROM_NAME,
        },
        to: data.customerEmail,
        subject: `Your seat is ready! Accept before ${formatIST(data.offerExpiresAt)} — ${data.eventTitle}`,
        html: buildWaitlistOfferHtml(data),
      });
    } catch (err) {
      console.error('[email] Waitlist offer error:', err);
    }
  });
}

// ─── Email HTML builders ──────────────────────────────────────────────────────

function buildBookingConfirmationHtml(data: BookingEmailData): string {
  const seatRows = data.seats
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">${s.row_label}${s.seat_number}</td>
          <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">${s.category_name}</td>
          <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">₹${s.price.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎟 Booking Confirmed!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your seats are secured</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#333;font-size:16px;">Hi <strong>${data.customerName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;">Your booking for <strong>${data.eventTitle}</strong> is confirmed.</p>

            <!-- Event details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8ff;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Event</p>
                  <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a2e;">${data.eventTitle}</p>
                  <p style="margin:0 0 4px;font-size:14px;color:#555;">📅 ${formatIST(data.showStartsAt)}</p>
                  <p style="margin:0;font-size:14px;color:#555;">📍 ${data.venueName}, ${data.venueCity}</p>
                </td>
              </tr>
            </table>

            <!-- Booking ref -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ff;border:2px dashed #667eea;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Booking Reference</p>
                  <p style="margin:0;font-size:24px;font-weight:700;color:#667eea;letter-spacing:2px;">${data.bookingRef}</p>
                </td>
              </tr>
            </table>

            <!-- Seats table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;margin-bottom:24px;overflow:hidden;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;">SEAT</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;">CATEGORY</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;">PRICE</th>
                </tr>
              </thead>
              <tbody>${seatRows}</tbody>
              <tfoot>
                <tr style="background:#f8f8ff;">
                  <td colspan="2" style="padding:12px 16px;font-weight:700;color:#1a1a2e;">Total</td>
                  <td style="padding:12px 16px;font-weight:700;color:#667eea;text-align:right;">₹${data.totalPrice.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <!-- QR Code -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <p style="margin:0 0 12px;font-size:14px;color:#555;">Show this QR code at the venue</p>
                  <img src="cid:qrCode" alt="QR Code" width="200" height="200" style="border:8px solid #f0f0f0;border-radius:12px;"/>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">Seatly · Enjoy the show! 🎭</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildWaitlistOfferHtml(data: WaitlistOfferEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎉 Your seat is ready!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">A spot just opened up for you</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#333;font-size:16px;">Hi <strong>${data.customerName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;">
              Good news! A <strong>${data.categoryName}</strong> seat for <strong>${data.eventTitle}</strong>
              on ${formatIST(data.showStartsAt)} is now available for you.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff3cd;border:2px solid #ffc107;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:13px;color:#856404;font-weight:600;">⏰ OFFER EXPIRES AT</p>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#856404;">${formatIST(data.offerExpiresAt)}</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${data.acceptUrl}"
                     style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);
                            color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;
                            font-size:16px;font-weight:700;letter-spacing:0.5px;">
                    🎟 Accept My Seat
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#aaa;text-align:center;">
              If you don't accept before the deadline, your spot will be offered to the next person in line.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface VerificationEmailData {
  customerName: string;
  customerEmail: string;
  verificationUrl: string;
}

export function sendVerificationEmail(data: VerificationEmailData): void {
  setImmediate(async () => {
    try {
      await sgMail.send({
        to: data.customerEmail,
        from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
        subject: `Verify your Seatly account`,
        html: buildVerificationEmailHtml(data),
      });
      console.log(`[email] Verification email sent to ${data.customerEmail}`);
    } catch (err) {
      console.error(`[email] Failed to send verification email to ${data.customerEmail}:`, err);
    }
  });
}

function buildVerificationEmailHtml(data: VerificationEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Welcome to Seatly! 🎟️</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Please verify your email address</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#333;font-size:16px;">Hi <strong>${data.customerName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Thanks for joining Seatly. To protect your account and enable seat bookings and event creation, please verify that you own this email address.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${data.verificationUrl}"
                     style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);
                            color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;
                            font-size:16px;font-weight:700;letter-spacing:0.5px;">
                    ✓ Verify Email Address
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#888;text-align:center;line-height:1.5;">
              This link is valid for 24 hours. If you didn't create an account with Seatly, you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">Seatly · Real-time Seat Booking & Ticketing</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

