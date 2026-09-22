import { describe, it, expect } from 'vitest';
import { applyPreset } from './presets';
import type { TokenRow } from '@/lib/domain';

function row(partial: Partial<TokenRow> & { symbol: string }): TokenRow {
  return {
    mint: partial.symbol,
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
    name: null,
    priceDisplay: 100,
    priceRaw: 100,
    markPrice: 100,
    markSource: 'prestocks',
    premiumPct: 0,
    effectiveMultiplier: 1,
    scaled: {
      decimals: 9,
      multiplier: 1,
      newMultiplier: 1,
      newMultiplierEffectiveTimestamp: 0,
      effectiveMultiplier: 1,
      hasScaledUiAmount: false,
      source: 'none',
    },
    liquidityUsd: null,
    volume24hUsd: null,
    volumeSource: 'none',
    holders: null,
    holdersSource: 'none',
    anomaly: false,
    anomalyDiagnostics: null,
    prestocksTokenPrice: null,
    prestocksMarkPrice: null,
    jupiterUsdPrice: null,
    jupiterUsdPricePrescaled: null,
    jupiterStockDataPrice: null,
    dexPriceUsd: null,
    qualityScore: 0,
    impliedMonthsToIpo: null,
    ...partial,
  };
}

describe('applyPreset', () => {
  const rows = [
    row({ symbol: 'A', premiumPct: -15 }),
    row({ symbol: 'B', premiumPct: 25 }),
    row({ symbol: 'C', premiumPct: 5, effectiveMultiplier: 5 }),
    row({ symbol: 'D', premiumPct: 0, liquidityUsd: 300_000 }),
  ];

  it('discount10', () => {
    expect(applyPreset(rows, 'discount10').map((r) => r.symbol)).toEqual([
      'A',
    ]);
  });
  it('premium20', () => {
    expect(applyPreset(rows, 'premium20').map((r) => r.symbol)).toEqual([
      'B',
    ]);
  });
  it('scaled', () => {
    expect(applyPreset(rows, 'scaled').map((r) => r.symbol)).toEqual(['C']);
  });
  it('liq250k', () => {
    expect(applyPreset(rows, 'liq250k').map((r) => r.symbol)).toEqual(['D']);
  });
});
