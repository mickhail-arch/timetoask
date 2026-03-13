// instrumentation.ts — Server startup hooks
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { CLEANUP_INTERVAL_MS } = await import('@/core/constants');
    const { purgeDeletedAccounts } = await import('@/modules/user');
    const { ToolRegistry } = await import('@/plugins/registry');
    // const { cleanupStaleReserves } = await import('@/modules/billing');
    // const { cleanupStaleJobs } = await import('@/modules/llm');

    await ToolRegistry.initialize();

    setInterval(() => {
      purgeDeletedAccounts().catch(console.error);
    }, CLEANUP_INTERVAL_MS);

    // setInterval(() => { cleanupStaleReserves().catch(console.error); }, CLEANUP_INTERVAL_MS);
    // setInterval(() => { cleanupStaleJobs().catch(console.error); }, CLEANUP_INTERVAL_MS);
  }
}
