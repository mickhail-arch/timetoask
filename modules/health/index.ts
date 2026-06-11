// modules/health/index.ts — публичный API + кэш в Redis (частые проверки без лишних запросов к провайдерам)
import { redis } from '@/lib/redis';
import { runHealthChecks } from './registry';
import type { HealthResult } from './types';

export * from './types';
export { runHealthChecks };

const CACHE_KEY = 'health:status';
const TTL_SEC = 120;

export interface HealthSnapshot { results: HealthResult[]; cachedAt: string; }

export async function getHealth(force = false): Promise<HealthSnapshot> {
  if (force) {
    // принудительная перепроверка: чистим снимок и кэши пингов моделей
    try {
      const pingKeys = await redis.keys('health:ping:*');
      const toDel = [CACHE_KEY, ...pingKeys];
      if (toDel.length) await redis.del(...toDel);
    } catch { /* игнорируем */ }
  } else {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as HealthSnapshot;
    } catch { /* кэш недоступен — пересчитаем */ }
  }
  const results = await runHealthChecks();
  const snapshot: HealthSnapshot = { results, cachedAt: new Date().toISOString() };
  try { await redis.set(CACHE_KEY, JSON.stringify(snapshot), 'EX', TTL_SEC); } catch { /* пропускаем */ }
  return snapshot;
}
