import { describe, it, expect } from 'vitest';
import { calculatePrice } from '../pricing';

describe('calculatePrice', () => {
  it('default config: 8000 chars, 0 images, 5 faq', () => {
    const r = calculatePrice(8000, 0, 5);
    expect(r.base).toBe(100);
    expect(r.chars).toBe(24); // ceil(8000/1000)*3
    expect(r.images).toBe(0);
    expect(r.faq).toBe(25); // 5*5
    expect(r.total).toBe(149);
  });

  it('min values: 4000 chars, 0 images, 0 faq', () => {
    const r = calculatePrice(4000, 0, 0);
    expect(r.total).toBe(112); // 100 + 12 + 0 + 0
  });

  it('max values: 20000 chars, 10 images, 10 faq', () => {
    const r = calculatePrice(20000, 10, 10);
    expect(r.chars).toBe(60); // ceil(20000/1000)*3
    expect(r.images).toBe(150); // 10*15
    expect(r.faq).toBe(50); // 10*5
    expect(r.total).toBe(360);
  });

  it('custom config overrides defaults', () => {
    const r = calculatePrice(8000, 2, 3, { base: 50, perImage: 20 });
    expect(r.base).toBe(50);
    expect(r.images).toBe(40); // 2*20
    expect(r.faq).toBe(15); // 3*5 (default)
  });

  it('partial config merges with defaults', () => {
    const r = calculatePrice(5000, 0, 0, { base: 200 });
    expect(r.base).toBe(200);
    expect(r.chars).toBe(15); // ceil(5000/1000)*3 (default perCharBlock)
  });
});
