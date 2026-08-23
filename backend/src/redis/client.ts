import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

const useRealRedis = process.env.REDIS_URL && 
                     !process.env.REDIS_URL.includes('localhost') && 
                     !process.env.REDIS_URL.includes('127.0.0.1') &&
                     process.env.REDIS_URL.startsWith('redis');

export const redis = useRealRedis
  ? new Redis(process.env.REDIS_URL!)
  : new RedisMock();

if (useRealRedis) {
  redis.on('connect', () => console.log('✅ Remote Redis connected'));
} else {
  redis.on('connect', () => console.log('✅ In-Memory Redis connected'));
}

redis.on('error', (err: unknown) => console.error('Redis error:', err));

export const redisSub = useRealRedis
  ? new Redis(process.env.REDIS_URL!)
  : ((redis as any).createConnectedClient
      ? (redis as any).createConnectedClient()
      : new RedisMock());

