import { describe, it, expect } from 'vitest';
import { inputSchema } from './schema';
import { buildUserMessage } from './handler';
import example from './example.json';

describe('seo-article-express plugin', () => {
  it('inputSchema validates example input', () => {
    const result = inputSchema.safeParse(example.input);
    expect(result.success).toBe(true);
  });

  it('buildUserMessage returns non-empty string', () => {
    const parsed = inputSchema.parse(example.input);
    const message = buildUserMessage(parsed);
    expect(message).toBeTruthy();
    expect(message.length).toBeGreaterThan(100);
    expect(message).toContain('кофемашину для дома');
  });

  it('buildUserMessage includes all required fields', () => {
    const parsed = inputSchema.parse(example.input);
    const message = buildUserMessage(parsed);
    expect(message).toContain('Тема статьи:');
    expect(message).toContain('Ключевые слова:');
    expect(message).toContain('Intent:');
    expect(message).toContain('8000');
  });
});
