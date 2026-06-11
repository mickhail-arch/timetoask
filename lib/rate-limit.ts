// lib/rate-limit.ts — простой лимитер на Redis (fixed window) + извлечение IP клиента
import { redis } from '@/lib/redis';

/**
 * Счётчик запросов в окне.
 * @returns true — в пределах лимита; false — лимит превышен.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const k = `rl:${key}`;
    const count = await redis.incr(k);
    if (count === 1) await redis.expire(k, windowSec);
    return count <= limit;
  } catch (err) {
    console.error('[rate-limit] Redis unavailable, fail-open:', err);
    return true;
  }
}

/** IP клиента из заголовков прокси (за nginx). */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
