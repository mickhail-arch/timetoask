// plugins/text-rewriter/handler.ts — Build user message (pure, no side effects)
import type { ToolInput } from './schema';

export function buildUserMessage(input: ToolInput): string {
  return `Tone: ${input.tone}\n\nText:\n${input.text}`;
}
