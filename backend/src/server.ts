import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { redis } from './redis/client';
import { initSocket } from './socket';
import { startKeyspaceSubscriber, setWaitlistServiceRef } from './redis/subscriber';
import { startExpiredHoldsCron } from './jobs/expiredHoldsCron';

import { runMigrations } from './db/migrate';
import { seedDatabase } from './db/seed';

async function bootstrap() {
  // Verify DB connection
  await pool.query('SELECT 1');
  console.log('✅ PostgreSQL connected');

  // Auto-run migrations on startup
  try {
    await runMigrations('up');
    const userCountRes = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM users');
    if (parseInt(userCountRes.rows[0].count, 10) === 0) {
      console.log('🌱 Database is empty. Running initial seed...');
      await seedDatabase(false);
    }
  } catch (migErr) {
    console.error('⚠️ Migration or seeding step encountered an issue:', migErr);
  }

  // Verify Redis connection
  try {
    await redis.ping();
    console.log('✅ Redis connected');
  } catch (redisErr) {
    console.warn('⚠️ Redis connection failed on startup. Server will continue with local fallback:', redisErr);
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.io
  initSocket(httpServer);
  console.log('✅ Socket.io initialized');

  // Start Redis keyspace notification subscriber
  startKeyspaceSubscriber();

  // Start fallback cron for expired holds (handles Redis restarts)
  startExpiredHoldsCron();

  // Wire waitlist service into the keyspace subscriber
  // (done lazily to avoid circular imports)
  const { waitlistService } = await import('./services/waitlistService');
  setWaitlistServiceRef(waitlistService);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    httpServer.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
