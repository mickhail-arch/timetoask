// plugins/text-rewriter/smoke.test.ts — Smoke test (no API calls)
import { describe, it, expect } from 'vitest';
import { inputSchema, outputSchema } from './schema';
import { buildUserMessage } from './handler';
import exampleFixture from './example.json';

describe('text-rewriter', () => {
  it('parses example.json input', () => {
    const input = inputSchema.parse(exampleFixture.input);
    expect(input.text).toBe(exampleFixture.input.text);
    expect(input.tone).toBe(exampleFixture.input.tone);
  });

  it('rejects text shorter than 10 characters', () => {
    expect(() => inputSchema.parse({ text: 'short', tone: 'formal' })).toThrow();
  });

  it('rejects text longer than 5000 characters', () => {
    expect(() => inputSchema.parse({ text: 'a'.repeat(5001), tone: 'casual' })).toThrow();
  });

  it('rejects missing tone', () => {
    expect(() => inputSchema.parse({ text: 'A valid text longer than ten chars' })).toThrow();
  });

  it('rejects invalid tone value', () => {
    expect(() => inputSchema.parse({ text: 'A valid text longer than ten chars', tone: 'aggressive' })).toThrow();
  });

  it('builds user message containing tone and text', () => {
    const input = inputSchema.parse(exampleFixture.input);
    const msg = buildUserMessage(input);
    expect(msg).toContain('formal');
    expect(msg).toContain(exampleFixture.input.text);
  });

  it('parses valid output', () => {
    const output = outputSchema.parse(exampleFixture.output);
    expect(output.rewritten).toBeTruthy();
    expect(output.changes_summary).toBeTruthy();
  });
});
