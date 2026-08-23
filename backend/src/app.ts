import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import organiserRouter from './routes/organiser';
import customerRouter from './routes/customer';
import waitlistRouter from './routes/waitlist';
import eventsRouter from './routes/events';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  
  const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow localhost or local IP
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow all Vercel deployments (*.vercel.app or preview URLs)
      if (origin.endsWith('.vercel.app') || origin.includes('vercel.app') || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Allow any explicit origins from environment variable
      if (env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }

      // Default safe allow in production for deployed clients
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });

  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
  });
  app.use('/api/', apiLimiter);
  app.use('/auth/', apiLimiter);

  // Auth endpoints get stricter limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many auth attempts, please try again later.' },
    skip: () => env.NODE_ENV === 'test',
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);

  // ─── Routes (mounted under both /api/* and /* for flexibility) ───────────────
  app.use('/api/auth', authRouter);
  app.use('/auth', authRouter);

  app.use('/api/admin', adminRouter);
  app.use('/admin', adminRouter);

  app.use('/api/organiser', organiserRouter);
  app.use('/organiser', organiserRouter);

  app.use('/api/customer', customerRouter);
  app.use('/customer', customerRouter);

  app.use('/api/waitlist', waitlistRouter);
  app.use('/waitlist', waitlistRouter);

  app.use('/api/events', eventsRouter);
  app.use('/events', eventsRouter);

  // ─── Health check & Root ───────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => res.json({ status: 'ok', message: 'Ticket Booking API is running', health: '/health' }));
  app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ─── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Route not found' }));

  // ─── Error handler (must be last) ──────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
