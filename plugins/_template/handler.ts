// plugins/_template/handler.ts — Build user message (pure, no side effects)
import type { ToolInput } from './schema';

export function buildUserMessage(input: ToolInput): string {
  return input.query;
}
