// instrumentation.ts — Server startup hooks
export async function register() {
  console.log('[instrumentation] register() called, runtime:', process.env.NEXT_RUNTIME)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { CLEANUP_INTERVAL_MS } = await import('@/core/constants');
    const { purgeDeletedAccounts } = await import('@/modules/user');
    const { ToolRegistry } = await import('@/plugins/registry');
    const { cleanupStaleReserves } = await import('@/modules/billing');
    const { cleanupStaleJobs } = await import('@/modules/llm');

    await ToolRegistry.initialize();
    console.log('[instrumentation] ToolRegistry initialized')
    await cleanupStaleReserves();
    console.log('[instrumentation] cleanup done')
    await cleanupStaleJobs();

    setInterval(() => {
      purgeDeletedAccounts().catch(console.error);
    }, CLEANUP_INTERVAL_MS);

    const g = globalThis as Record<string, unknown>;
    if (g.__cleanupInterval) clearInterval(g.__cleanupInterval as NodeJS.Timeout);
    g.__cleanupInterval = setInterval(() => {
      cleanupStaleReserves().catch(console.error);
      cleanupStaleJobs().catch(console.error);
    }, CLEANUP_INTERVAL_MS);
  }
}
