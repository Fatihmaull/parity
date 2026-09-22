import { describe, it, expect } from 'vitest';
import {
  rawUnitsFromAmount,
  resolveUiAmount,
  valueHolding,
} from './value';

describe('portfolio valuation', () => {
  it('rawUnitsFromAmount divides by 10^decimals', () => {
    expect(rawUnitsFromAmount('1000000000', 9)).toBe(1);
    expect(rawUnitsFromAmount('5000000000', 9)).toBe(5);
  });

  it('prefers RPC uiAmount (already scaled) — no double-apply', () => {
    const ui = resolveUiAmount({
      amountRaw: '1000000000', // 1 raw unit
      decimals: 9,
      uiAmount: 5, // RPC already applied m=5
      effectiveMultiplier: 5,
    });
    expect(ui).toBe(5);
  });

  it('SPACEX m=5: correct vs crossed', () => {
    // 1 raw unit → uiAmount 5; usdPrice 100; usdPricePrescaled 500
    const v = valueHolding(
      {
        amountRaw: '1000000000',
        decimals: 9,
        uiAmount: 5,
        effectiveMultiplier: 5,
      },
      { usdPrice: 100, usdPricePrescaled: 500 },
    );
    expect(v.valueDisplay).toBe(500); // 5 × 100
    expect(v.valueRawConvention).toBe(500); // 1 × 500
    expect(v.crossedScaledTimesPrescaled).toBe(2500); // 5 × 500 = wrong ×m
    expect(v.crossedRawTimesUsdPrice).toBe(100); // 1 × 100 = wrong ÷m
  });
});
