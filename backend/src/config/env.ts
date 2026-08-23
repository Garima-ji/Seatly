import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().default('postgres://localhost/local_database'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().default('tq4GvR2oXQZ5LpY8sKbVjDwH2mN5qF7t'),
  JWT_REFRESH_SECRET: z.string().default('xK7vM8n2P9sQbY4tDwR6zJ1cK3vL5pG7'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  HOLD_TTL_SECONDS: z.coerce.number().default(600),
  WAITLIST_OFFER_TTL_SECONDS: z.coerce.number().default(1800),
  MAX_SEATS_PER_ORDER: z.coerce.number().default(6),

  SENDGRID_API_KEY: z.string().default('SG.placeholder_key'),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email').default('garima1111patel@gmail.com'),
  EMAIL_FROM_NAME: z.string().default('Seatly'),

  WAITLIST_TOKEN_SECRET: z.string().default('yP9sQbY4tDwR6zJ1cK3vL5pG7tq4GvR2'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173').transform((str) => str.split(',').map(s => s.trim())),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
