// lib/concurrency.ts — Redis-based concurrency slots
import { redis } from '@/lib/redis';
import { MAX_CONCURRENT_GLOBAL, MAX_CONCURRENT_PER_USER } from '@/core/constants';

const GLOBAL_KEY = 'global:concurrent';
const userKey = (userId: string) => `user:concurrent:${userId}`;

// Atomically decrements a key but clamps the result to 0.
const DECR_MIN_ZERO = `
  local v = redis.call('DECR', KEYS[1])
  if v < 0 then redis.call('SET', KEYS[1], 0) end
`;

export async function acquireSlot(userId: string): Promise<boolean> {
  const globalCount = await redis.incr(GLOBAL_KEY);
  if (globalCount > MAX_CONCURRENT_GLOBAL) {
    await redis.eval(DECR_MIN_ZERO, 1, GLOBAL_KEY);
    return false;
  }

  const userCount = await redis.incr(userKey(userId));
  if (userCount > MAX_CONCURRENT_PER_USER) {
    await redis.eval(DECR_MIN_ZERO, 1, userKey(userId));
    await redis.eval(DECR_MIN_ZERO, 1, GLOBAL_KEY);
    return false;
  }

  return true;
}

export async function releaseSlot(userId: string): Promise<void> {
  await Promise.all([
    redis.eval(DECR_MIN_ZERO, 1, GLOBAL_KEY),
    redis.eval(DECR_MIN_ZERO, 1, userKey(userId)),
  ]);
}
