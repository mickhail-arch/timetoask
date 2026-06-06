import { describe, it, expect } from 'vitest';
import { calculatePrice } from '../pricing';

describe('calculatePrice (cost-based model)', () => {
  it('возвращает корректную структуру PriceBreakdown', () => {
    const r = calculatePrice(8000, 2, 3, null, 'opus47', 'sonnet');
    expect(r).toHaveProperty('total');
    expect(r).toHaveProperty('chars');
    expect(r).toHaveProperty('images');
    expect(r).toHaveProperty('analysisCost');
    expect(typeof r.total).toBe('number');
  });

  it('Opus дороже Gemini на том же объёме', () => {
    const opus = calculatePrice(8000, 2, 3, null, 'opus47', 'sonnet');
    const gemini = calculatePrice(8000, 2, 3, null, 'gemini', 'sonnet');
    expect(opus.total).toBeGreaterThan(gemini.total);
  });

  it('больше картинок — выше цена', () => {
    const noImg = calculatePrice(8000, 0, 0, null, 'sonnet', 'sonnet');
    const withImg = calculatePrice(8000, 3, 0, null, 'sonnet', 'sonnet');
    expect(withImg.total).toBeGreaterThan(noImg.total);
  });

  it('соблюдается минимальная цена', () => {
    const r = calculatePrice(500, 0, 0, null, 'gemini', 'gemini');
    expect(r.total).toBeGreaterThanOrEqual(50);
  });

  it('analysisCost — доля от total', () => {
    const r = calculatePrice(8000, 2, 3, null, 'opus47', 'sonnet');
    expect(r.analysisCost).toBe(Math.round(r.total * 0.15));
  });
});
