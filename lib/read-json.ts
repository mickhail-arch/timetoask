// lib/read-json.ts — чтение JSON-тела с лимитом размера (защита от гигантских payload)
import { PayloadTooLargeError } from '@/core/errors';

const DEFAULT_MAX_BYTES = 256 * 1024; // 256 KB — с запасом для обычных форм-инпутов

export async function readJson<T = unknown>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<T> {
  const len = req.headers.get('content-length');
  if (len && Number(len) > maxBytes) {
    throw new PayloadTooLargeError();
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new PayloadTooLargeError();
  }
  return JSON.parse(text) as T;
}
