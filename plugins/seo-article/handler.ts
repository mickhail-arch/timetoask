import type { ToolInput } from './schema';

export function buildUserMessage(input: ToolInput): string {
  return JSON.stringify({
    keyword: input.keyword,
    language: input.language,
    wordCount: input.wordCount,
    autoMode: input.autoMode,
  });
}
