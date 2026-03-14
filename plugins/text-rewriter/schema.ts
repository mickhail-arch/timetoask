// plugins/text-rewriter/schema.ts — Zod input/output schemas
import { z } from 'zod';

export const inputSchema = z.object({
  text: z.string().min(10).max(5000).describe('Исходный текст'),
  tone: z.enum(['formal', 'casual', 'persuasive']).describe('Тон'),
});

export type ToolInput = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  rewritten: z.string(),
  changes_summary: z.string(),
});

export type ToolOutput = z.infer<typeof outputSchema>;
