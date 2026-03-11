// instrumentation.ts — Server startup hooks
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ToolRegistry.initialize()
    // cleanupStaleReserves()
    // cleanupStaleJobs()
  }
}
