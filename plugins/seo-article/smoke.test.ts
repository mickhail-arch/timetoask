import { describe, it, expect } from 'vitest';
import { inputSchema, outputSchema } from './schema';
import { buildUserMessage } from './handler';
import exampleFixture from './example.json';

describe('seo-article', () => {
  it('parses example.json input', () => {
    const input = inputSchema.parse(exampleFixture.input);
    expect(input.keyword).toBe(exampleFixture.input.keyword);
    expect(input.language).toBe('ru');
    expect(input.wordCount).toBe(2000);
    expect(input.autoMode).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const input = inputSchema.parse({ keyword: 'test' });
    expect(input.language).toBe('ru');
    expect(input.wordCount).toBe(2000);
    expect(input.autoMode).toBe(true);
  });

  it('rejects missing keyword', () => {
    expect(() => inputSchema.parse({})).toThrow();
  });

  it('rejects wordCount below 500', () => {
    expect(() =>
      inputSchema.parse({ keyword: 'test', wordCount: 100 }),
    ).toThrow();
  });

  it('rejects wordCount above 5000', () => {
    expect(() =>
      inputSchema.parse({ keyword: 'test', wordCount: 10000 }),
    ).toThrow();
  });

  it('rejects invalid language', () => {
    expect(() =>
      inputSchema.parse({ keyword: 'test', language: 'de' }),
    ).toThrow();
  });

  it('builds user message as JSON with all fields', () => {
    const input = inputSchema.parse(exampleFixture.input);
    const msg = buildUserMessage(input);
    const parsed = JSON.parse(msg);
    expect(parsed.keyword).toBe(exampleFixture.input.keyword);
    expect(parsed.language).toBe('ru');
    expect(parsed.wordCount).toBe(2000);
    expect(parsed.autoMode).toBe(true);
  });

  it('parses valid output', () => {
    const output = outputSchema.parse(exampleFixture.output);
    expect(output.html).toContain('<article>');
    expect(output.metadata.title).toBeTruthy();
    expect(output.metadata.description).toBeTruthy();
    expect(output.metadata.keyword).toBe(exampleFixture.input.keyword);
    expect(output.seoAudit.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(output.seoAudit.issues)).toBe(true);
    expect(typeof output.factCheck.verified).toBe('boolean');
    expect(Array.isArray(output.factCheck.corrections)).toBe(true);
  });
});
