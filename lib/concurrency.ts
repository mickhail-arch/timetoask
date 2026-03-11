// lib/concurrency.ts — Redis-based concurrency slots

export async function acquireSlot(_userId: string): Promise<boolean> {
  throw new Error('Not implemented');
}

export async function releaseSlot(_userId: string): Promise<void> {
  throw new Error('Not implemented');
}
