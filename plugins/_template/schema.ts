// plugins/_template/schema.ts — Zod input/output schemas
import { z } from 'zod';

export const inputSchema = z.object({
  query: z.string().describe('Запрос'),
});

export type ToolInput = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  result: z.string(),
});

export type ToolOutput = z.infer<typeof outputSchema>;
