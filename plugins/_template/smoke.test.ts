// plugins/_template/smoke.test.ts — Smoke test (no API calls)
import { describe, it, expect } from 'vitest';
import { inputSchema, outputSchema } from './schema';
import { buildUserMessage } from './handler';

describe('_template', () => {
  it('parses valid input', () => {
    const input = inputSchema.parse({ query: 'тест' });
    expect(input.query).toBe('тест');
  });

  it('rejects empty input', () => {
    expect(() => inputSchema.parse({})).toThrow();
  });

  it('builds user message from input', () => {
    const msg = buildUserMessage({ query: 'привет' });
    expect(msg).toBe('привет');
  });

  it('parses valid output', () => {
    const output = outputSchema.parse({ result: 'ответ' });
    expect(output.result).toBe('ответ');
  });
});
