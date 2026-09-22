import { describe, it, expect } from 'vitest';
import { liquidityQualityScore } from './quality';

describe('liquidityQualityScore', () => {
  it('returns 0 for all-null inputs', () => {
    expect(
      liquidityQualityScore({
        liquidityUsd: null,
        volume24hUsd: null,
        holders: null,
      }),
    ).toBe(0);
  });

  it('scores high for deep book', () => {
    const s = liquidityQualityScore({
      liquidityUsd: 1_000_000,
      volume24hUsd: 500_000,
      holders: 10_000,
    });
    expect(s).toBeGreaterThanOrEqual(95);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('scores mid for thin market', () => {
    const s = liquidityQualityScore({
      liquidityUsd: 50_000,
      volume24hUsd: 10_000,
      holders: 500,
    });
    expect(s).toBeGreaterThan(20);
    expect(s).toBeLessThan(80);
  });
});
