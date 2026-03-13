// lib/redis.ts — Redis client singleton
import Redis from 'ioredis';
import { env } from '@/core/config/env';

const globalForRedis = globalThis as unknown as { __redis?: Redis };

const redis =
  globalForRedis.__redis ??
  new Redis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.__redis = redis;
}

export { redis };
