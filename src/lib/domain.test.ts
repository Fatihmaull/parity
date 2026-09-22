import { describe, it, expect } from 'vitest';
import {
  normalizeTokenRows,
  priceForConvention,
  markForConvention,
  type PrestocksBundle,
} from './domain';
import type { MintScaledConfig } from './rpc/mintConfig';
import type { JupiterPriceMap } from './jupiter/price';

const SPACEX_MINT = 'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh';

function spacexFixture() {
  const prestocks: PrestocksBundle = {
    catalogue: [
      {
        symbol: 'SPACEX',
        contract_address: SPACEX_MINT,
        markPrice: 153.0801328260084,
        tokenPrice: 116.33013473367114,
        name: 'SpaceX PreStocks',
      },
    ],
    metrics: {
      metrics: [
        {
          symbol: 'SPACEX',
          splMint: SPACEX_MINT,
          holderCount: 12345,
          tokenPrice: 116.33013473367114,
        },
      ],
    },
    stats: null,
  };

  const jupiterPrices: JupiterPriceMap = {
    [SPACEX_MINT]: {
      usdPrice: 116.33013473367114,
      decimals: 9,
      liquidity: 111266,
      scaledUiConfig: {
        multiplier: 1,
        newMultiplier: 5,
        newMultiplierEffectiveTimestamp: 1781065800,
        usdPricePrescaled: 581.6506736683557,
      },
      stockData: { id: 'prestocks', price: 150.6374424677567 },
    },
  };

  const mintConfigs = new Map<string, MintScaledConfig>([
    [
      SPACEX_MINT,
      {
        mint: SPACEX_MINT,
        decimals: 9,
        multiplier: 1,
        newMultiplier: 5,
        newMultiplierEffectiveTimestamp: 1781065800,
        effectiveMultiplier: 5,
        fetchedAtSec: 1_790_000_000,
      },
    ],
  ]);

  return normalizeTokenRows({
    prestocks,
    jupiterPrices,
    mintConfigs,
    nowSec: 1_790_000_000,
  });
}

describe('normalizeTokenRows SPACEX', () => {
  it('flags |premium| > 20% and keeps m=5', () => {
    const rows = spacexFixture();
    const sx = rows.find((r) => r.symbol === 'SPACEX');
    expect(sx).toBeDefined();
    expect(sx!.effectiveMultiplier).toBe(5);
    expect(sx!.premiumPct).not.toBeNull();
    expect(Math.abs(sx!.premiumPct!)).toBeGreaterThan(20);
    expect(sx!.anomaly).toBe(true);
    expect(sx!.holders).toBe(12345);
    expect(sx!.holdersSource).toBe('metrics');
    expect(sx!.markSource).toBe('prestocks');
  });

  it('Display⇄Raw changes prices but NEVER premium %', () => {
    const rows = spacexFixture();
    const sx = rows.find((r) => r.symbol === 'SPACEX')!;
    const prem = sx.premiumPct!;

    const displayPrice = priceForConvention(sx, 'display');
    const rawPrice = priceForConvention(sx, 'raw');
    const displayMark = markForConvention(sx, 'display');
    const rawMark = markForConvention(sx, 'raw');

    expect(displayPrice).toBeCloseTo(116.33013473367114, 8);
    expect(rawPrice).toBeCloseTo(581.6506736683557, 8);
    expect(displayMark).toBeCloseTo(153.0801328260084, 8);
    expect(rawMark).toBeCloseTo(153.0801328260084 * 5, 8);

    // Recompute premium from each convention pair — must match stored premium
    const premDisplay =
      ((displayPrice! - displayMark!) / displayMark!) * 100;
    const premRaw = ((rawPrice! - rawMark!) / rawMark!) * 100;

    expect(premDisplay).toBeCloseTo(prem, 10);
    expect(premRaw).toBeCloseTo(prem, 10);
    expect(premDisplay).toBeCloseTo(premRaw, 10);
  });
});
