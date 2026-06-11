// lib/idempotency.ts — атомарная защита от двойного списания (double-submit / retry)
import { redis } from '@/lib/redis';

const PREFIX = 'idemp:';
const DEFAULT_TTL_SEC = 90;

/**
 * Пытается занять ключ идемпотентности.
 * @returns true — первый запрос (можно резервировать/списывать);
 *          false — дубликат (операция с этим ключом уже идёт или недавно прошла).
 */
export async function acquireIdempotency(
  key: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<boolean> {
  try {
    const res = await redis.set(`${PREFIX}${key}`, '1', 'EX', ttlSec, 'NX');
    return res === 'OK';
  } catch {
    console.error('[idempotency] Redis unavailable, fail-closed');
    return false;
  }
}

/**
 * Освобождает ключ. Вызывать при ошибке/откате, чтобы пользователь мог сразу повторить.
 */
export async function releaseIdempotency(key: string): Promise<void> {
  try {
    await redis.del(`${PREFIX}${key}`);
  } catch (err) {
    console.error('[idempotency] Failed to release key:', err);
  }
}
