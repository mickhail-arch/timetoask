// plugins/_template/index.ts — ITool entry point
export { inputSchema, outputSchema } from './schema';
export type { ToolInput, ToolOutput } from './schema';
export { systemPrompt } from './prompt';
export { buildUserMessage } from './handler';
