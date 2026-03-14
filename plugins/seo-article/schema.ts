import { z } from 'zod';

export const inputSchema = z.object({
  keyword: z.string().describe('Главное ключевое слово'),
  language: z.enum(['ru', 'en']).default('ru').describe('Язык статьи'),
  wordCount: z.number().min(500).max(5000).default(2000).describe('Объём'),
  autoMode: z.boolean().default(true).describe('Авто без подтверждений'),
});

export type ToolInput = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  html: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    keyword: z.string(),
  }),
  seoAudit: z.object({
    score: z.number(),
    issues: z.array(z.string()),
  }),
  factCheck: z.object({
    verified: z.boolean(),
    corrections: z.array(z.string()),
  }),
});

export type ToolOutput = z.infer<typeof outputSchema>;
