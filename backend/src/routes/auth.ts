import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { BCRYPT_ROUNDS, USER_ROLES } from '../config/constants';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { sendVerificationEmail } from '../services/emailService';

const router = Router();

// ─── Disposable Email Domain Blocklist ────────────────────────────────────────

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'yopmail.com', 'throwawaymail.com', 'dispostable.com', 'sharklasers.com',
  'trashmail.com', 'getairmail.com', 'maildrop.cc', 'getnada.com',
  'fakemailgenerator.com', 'temp-mail.org', 'tempail.com', 'inboxkitten.com'
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(USER_ROLES as unknown as [string, ...string[]]).default('customer'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Verification token required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const googleAuthSchema = z.object({
  credential: z.string().optional(),
  idToken: z.string().optional(),
  role: z.enum(USER_ROLES as unknown as [string, ...string[]]).optional(),
});

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification email requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signAccessToken(user: { id: string; email: string; role: string; full_name: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, fullName: user.full_name },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

async function storeRefreshToken(userId: string, token: string) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
     VALUES($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, hash, expiresAt]
  );
}

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  aud?: string;
  iss?: string;
  exp?: string | number;
}

async function verifyGoogleToken(token: string): Promise<GoogleTokenInfo> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new AppError(401, 'Invalid or expired Google token');
  }
  const payload = (await response.json()) as GoogleTokenInfo;

  if (!payload.sub || !payload.email) {
    throw new AppError(401, 'Invalid Google token payload');
  }

  const isVerified = payload.email_verified === 'true' || payload.email_verified === true;
  if (!isVerified) {
    throw new AppError(401, 'Google email address is not verified');
  }

  if (env.GOOGLE_CLIENT_ID && payload.aud && payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AppError(401, 'Google token audience mismatch');
  }

  return payload;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { full_name, email, phone, password, role? }
 * Returns: { user, accessToken, refreshToken, message }
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    if (isDisposableEmail(body.email)) {
      throw new AppError(400, 'Disposable email addresses are not permitted. Please use a permanent email address.');
    }

    // Check duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      throw new AppError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified)
       VALUES($1, $2, $3, $4, $5, false)
       RETURNING id, full_name, email, phone, role, email_verified, dark_mode_pref, created_at`,
      [body.full_name, body.email, body.phone, passwordHash, body.role]
    );

    const user = result.rows[0];

    // Generate single-use email verification token (24h expiry)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verifications(user_id, token_hash, expires_at)
       VALUES($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    sendVerificationEmail({
      customerName: user.full_name,
      customerEmail: user.email,
      verificationUrl,
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
      message: 'Account created! Please check your email to verify your account.',
    });
  })
);

/**
 * POST /auth/verify-email
 * Body: { token }
 */
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await withTransaction(async (client) => {
      const verRes = await client.query(
        `SELECT id, user_id, expires_at, used_at FROM email_verifications
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash]
      );

      if (verRes.rows.length === 0) {
        throw new AppError(400, 'Invalid verification link.');
      }

      const ver = verRes.rows[0];
      if (ver.used_at) {
        throw new AppError(400, 'This verification link has already been used.');
      }

      if (new Date(ver.expires_at) <= new Date()) {
        throw new AppError(400, 'This verification link has expired. Please request a new one.');
      }

      // Mark token used
      await client.query(`UPDATE email_verifications SET used_at = now() WHERE id = $1`, [ver.id]);

      // Mark user verified
      await client.query(`UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1`, [ver.user_id]);
    });

    res.json({ message: 'Email verified successfully! You can now use all platform features.' });
  })
);

/**
 * POST /auth/resend-verification
 * Body: { email }
 */
router.post(
  '/resend-verification',
  resendVerificationLimiter,
  asyncHandler(async (req, res) => {
    const { email } = resendVerificationSchema.parse(req.body);

    const userRes = await pool.query(
      `SELECT id, full_name, email, email_verified FROM users WHERE email = $1`,
      [email]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].email_verified) {
      // Return success to avoid email enumeration
      res.json({ message: 'If an unverified account exists with that email, a verification link has been sent.' });
      return;
    }

    const user = userRes.rows[0];

    // Invalidate previous unused tokens for this user
    await pool.query(
      `DELETE FROM email_verifications WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    // Generate new token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verifications(user_id, token_hash, expires_at)
       VALUES($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    sendVerificationEmail({
      customerName: user.full_name,
      customerEmail: user.email,
      verificationUrl,
    });

    res.json({ message: 'A new verification email has been sent. Please check your inbox.' });
  })
);

/**
 * POST /auth/google
 * Authenticates with Google ID token.
 */
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const body = googleAuthSchema.parse(req.body);
    const token = body.credential || body.idToken;
    if (!token) {
      throw new AppError(400, 'Google token (credential or idToken) is required');
    }

    const googleUser = await verifyGoogleToken(token);

    // 1. Check if user exists by google_id
    const userByGoogleId = await pool.query(
      `SELECT id, full_name, email, phone, role, email_verified, google_id, dark_mode_pref
       FROM users WHERE google_id = $1`,
      [googleUser.sub]
    );

    if (userByGoogleId.rows.length > 0) {
      const user = userByGoogleId.rows[0];
      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user.id);
      await storeRefreshToken(user.id, refreshToken);
      res.json({ user, accessToken, refreshToken });
      return;
    }

    // 2. Check if user exists with matching email
    const userByEmail = await pool.query(
      `SELECT id, full_name, email, phone, role, email_verified, google_id, dark_mode_pref
       FROM users WHERE email = $1`,
      [googleUser.email]
    );

    if (userByEmail.rows.length > 0) {
      const existingUser = userByEmail.rows[0];
      // If user has a password account and hasn't explicitly linked Google:
      // Require authenticated account linking to avoid automatic silent merging
      if (!existingUser.google_id) {
        throw new AppError(
          409,
          'An account with this email already exists. Please log in with your password and link your Google account in Settings, or sign in using email/password.'
        );
      }
    }

    // 3. New Google user registration
    const requestedRole = body.role === 'organiser' ? 'organiser' : 'customer';
    const fullName = googleUser.name || 'Google User';

    const insertRes = await pool.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role, email_verified, google_id)
       VALUES($1, $2, '', 'OAUTH_GOOGLE', $3, true, $4)
       RETURNING id, full_name, email, phone, role, email_verified, google_id, dark_mode_pref, created_at`,
      [fullName, googleUser.email, requestedRole, googleUser.sub]
    );

    const newUser = insertRes.rows[0];
    const accessToken = signAccessToken(newUser);
    const refreshToken = signRefreshToken(newUser.id);
    await storeRefreshToken(newUser.id, refreshToken);

    res.status(201).json({ user: newUser, accessToken, refreshToken });
  })
);

/**
 * POST /auth/google/link
 * Links Google ID to currently authenticated account.
 */
router.post(
  '/google/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = googleAuthSchema.parse(req.body);
    const token = body.credential || body.idToken;
    if (!token) throw new AppError(400, 'Google token is required');

    const googleUser = await verifyGoogleToken(token);

    // Check if this google_id is already linked to another account
    const existingGoogle = await pool.query(
      `SELECT id FROM users WHERE google_id = $1 AND id != $2`,
      [googleUser.sub, req.user!.sub]
    );
    if (existingGoogle.rows.length > 0) {
      throw new AppError(409, 'This Google account is already linked to another user.');
    }

    await pool.query(
      `UPDATE users SET google_id = $1, email_verified = true, updated_at = now() WHERE id = $2`,
      [googleUser.sub, req.user!.sub]
    );

    res.json({ message: 'Google account linked successfully' });
  })
);

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns: { user, accessToken, refreshToken }
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const result = await pool.query(
      `SELECT id, full_name, email, phone, password_hash, role, email_verified, google_id, dark_mode_pref
       FROM users WHERE email = $1`,
      [body.email]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'Invalid email or password');
    }

    const user = result.rows[0];
    if (user.password_hash === 'OAUTH_GOOGLE') {
      throw new AppError(400, 'This account uses Google Sign-In. Please click "Continue with Google".');
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password');
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  })
);

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 * Returns: { accessToken, refreshToken }
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(401, 'Refresh token required');

    let payload: { sub: string };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND expires_at > now()`,
      [payload.sub, hash]
    );

    if (stored.rows.length === 0) {
      throw new AppError(401, 'Refresh token revoked or expired');
    }

    // Rotate: delete old, issue new
    await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hash]);

    const userRes = await pool.query(
      `SELECT id, full_name, email, role, email_verified, google_id FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (userRes.rows.length === 0) throw new AppError(401, 'User not found');

    const user = userRes.rows[0];
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  })
);

/**
 * POST /auth/logout
 * Revokes the refresh token.
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hash]);
    }
    res.json({ message: 'Logged out successfully' });
  })
);

/**
 * PATCH /auth/preferences
 * Update dark_mode_pref (persisted per user in DB).
 */
router.patch(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { dark_mode_pref } = req.body;
    if (typeof dark_mode_pref !== 'boolean') {
      throw new AppError(400, 'dark_mode_pref must be a boolean');
    }
    await pool.query(
      `UPDATE users SET dark_mode_pref = $1, updated_at = now() WHERE id = $2`,
      [dark_mode_pref, req.user!.sub]
    );
    res.json({ dark_mode_pref });
  })
);

/**
 * GET /auth/me
 * Returns current user profile.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, email_verified, google_id, dark_mode_pref, created_at
       FROM users WHERE id = $1`,
      [req.user!.sub]
    );
    if (result.rows.length === 0) throw new AppError(404, 'User not found');
    res.json(result.rows[0]);
  })
);

export default router;

