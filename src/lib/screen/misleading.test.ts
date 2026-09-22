import { describe, it, expect } from 'vitest';
import { misleadingPremium } from './misleading';
import type { TokenRow } from '@/lib/domain';

function base(over: Partial<TokenRow>): TokenRow {
  return {
    symbol: 'SPACEX',
    mint: 'x',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
    name: null,
    priceDisplay: 116.33,
    priceRaw: 581.65,
    markPrice: 153.08,
    markSource: 'prestocks',
    premiumPct: ((116.33 - 153.08) / 153.08) * 100,
    effectiveMultiplier: 5,
    scaled: {
      decimals: 9,
      multiplier: 1,
      newMultiplier: 5,
      newMultiplierEffectiveTimestamp: 1,
      effectiveMultiplier: 5,
      hasScaledUiAmount: true,
      source: 'rpc',
    },
    liquidityUsd: null,
    volume24hUsd: null,
    volumeSource: 'none',
    holders: null,
    holdersSource: 'none',
    anomaly: true,
    anomalyDiagnostics: null,
    prestocksTokenPrice: 116.33,
    prestocksMarkPrice: 153.08,
    jupiterUsdPrice: 116.33,
    jupiterUsdPricePrescaled: 581.65,
    jupiterStockDataPrice: null,
    dexPriceUsd: null,
    qualityScore: 0,
    impliedMonthsToIpo: null,
    ...over,
  };
}

describe('misleadingPremium', () => {
  it('shows huge crossed premium for SPACEX m=5', () => {
    const m = misleadingPremium(base({}));
    expect(m.correctPct).toBeLessThan(-20);
    expect(m.crossedPct).toBeGreaterThan(200);
    expect(m.differs).toBe(true);
  });

  it('does not differ when m=1', () => {
    const m = misleadingPremium(
      base({
        effectiveMultiplier: 1,
        priceRaw: 116.33,
        premiumPct: ((116.33 - 153.08) / 153.08) * 100,
      }),
    );
    expect(m.differs).toBe(false);
  });
});
