import { describe, it, expect } from 'vitest';
import {
  effectiveMultiplier,
  premiumPct,
  rawToDisplayAmount,
  displayToRawAmount,
  usdPriceToPrescaled,
  usdPricePrescaledToPrice,
  relativePriceConventionError,
  PRICE_CONVENTION_TOLERANCE,
} from './scaled';

describe('effectiveMultiplier (>= rule)', () => {
  const cfg = {
    multiplier: 1,
    newMultiplier: 5,
    newMultiplierEffectiveTimestamp: 1_700_000_000,
  };

  it('uses multiplier before effective timestamp', () => {
    expect(effectiveMultiplier(cfg, 1_699_999_999)).toBe(1);
  });

  it('uses newMultiplier at exact effective timestamp (>=)', () => {
    expect(effectiveMultiplier(cfg, 1_700_000_000)).toBe(5);
  });

  it('uses newMultiplier after effective timestamp', () => {
    expect(effectiveMultiplier(cfg, 1_800_000_000)).toBe(5);
  });
});

describe('SPACEX m=5 conversion math', () => {
  const m = 5;
  const decimals = 9;

  it('raw → display multiplies by m', () => {
    // 1 raw unit at 9 decimals = 1e-9 tokens * 5 = 5e-9 display
    expect(rawToDisplayAmount(1, decimals, m)).toBeCloseTo(5e-9, 20);
    // 1e9 raw = 1.0 * 5 = 5.0 display
    expect(rawToDisplayAmount(1_000_000_000, decimals, m)).toBe(5);
  });

  it('display → raw divides by m', () => {
    expect(displayToRawAmount(5, decimals, m)).toBe(1_000_000_000);
  });

  it('usdPrice * m = usdPricePrescaled', () => {
    const usdPrice = 20; // per scaled unit
    const prescaled = usdPriceToPrescaled(usdPrice, m);
    expect(prescaled).toBe(100);
    expect(usdPricePrescaledToPrice(prescaled, m)).toBe(20);
    const err = relativePriceConventionError(usdPrice, prescaled, m);
    expect(err).toBeLessThanOrEqual(PRICE_CONVENTION_TOLERANCE);
  });
});

describe('m=1 token (identity)', () => {
  it('display equals raw/10^decimals', () => {
    expect(rawToDisplayAmount(1_000_000, 6, 1)).toBe(1);
    expect(displayToRawAmount(1, 6, 1)).toBe(1_000_000);
  });

  it('usdPrice === usdPricePrescaled', () => {
    expect(usdPriceToPrescaled(42.5, 1)).toBe(42.5);
    expect(
      relativePriceConventionError(42.5, 42.5, 1),
    ).toBeLessThanOrEqual(PRICE_CONVENTION_TOLERANCE);
  });
});

describe('premiumPct', () => {
  it('computes (price/mark - 1)*100', () => {
    expect(premiumPct(110, 100)).toBeCloseTo(10, 10);
    expect(premiumPct(90, 100)).toBeCloseTo(-10, 10);
  });

  it('returns null for bad inputs', () => {
    expect(premiumPct(10, 0)).toBeNull();
    expect(premiumPct(NaN, 100)).toBeNull();
  });
});
