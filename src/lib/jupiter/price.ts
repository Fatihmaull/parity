/**
 * Jupiter Price API v3 client for PreStocks universe mints.
 * Asserts usdPrice * effectiveMultiplier ≈ usdPricePrescaled when scaledUiConfig present.
 */

import { UNIVERSE, UNIVERSE_BY_MINT } from '@/config/universe';
import {
  PRICE_CONVENTION_TOLERANCE,
  relativePriceConventionError,
  effectiveMultiplier,
  type ScaledUiConfigLike,
} from '@/lib/scaled';
import type { MintScaledConfig } from '@/lib/rpc/mintConfig';

const JUPITER_PRICE_V3 = 'https://lite-api.jup.ag/price/v3';

export interface JupiterScaledUiConfig {
  multiplier?: number;
  newMultiplier?: number;
  newMultiplierEffectiveTimestamp?: number | string;
  usdPricePrescaled?: number;
}

export interface JupiterPriceEntry {
  usdPrice?: number;
  decimals?: number;
  blockId?: number;
  /** Optional; independently optional from stockData */
  scaledUiConfig?: JupiterScaledUiConfig | null;
  stockData?: unknown;
  [key: string]: unknown;
}

export type JupiterPriceMap = Record<string, JupiterPriceEntry | undefined>;

export interface JupiterFetchResult {
  ok: boolean;
  status: number;
  prices: JupiterPriceMap;
  rateLimited: boolean;
  error?: string;
  fetchedAt: string;
}

export async function fetchJupiterPrices(
  mints: readonly string[] = UNIVERSE.map((t) => t.mint),
): Promise<JupiterFetchResult> {
  const fetchedAt = new Date().toISOString();
  const ids = mints.join(',');
  const url = `${JUPITER_PRICE_V3}?ids=${encodeURIComponent(ids)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Node runtime — never edge
      cache: 'no-store',
    });

    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        prices: {},
        rateLimited: true,
        error: 'Jupiter rate limit exceeded (429)',
        fetchedAt,
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        prices: {},
        rateLimited: false,
        error: `Jupiter HTTP ${res.status}: ${text.slice(0, 200)}`,
        fetchedAt,
      };
    }

    const body = (await res.json()) as JupiterPriceMap;
    return {
      ok: true,
      status: res.status,
      prices: body ?? {},
      rateLimited: false,
      fetchedAt,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      prices: {},
      rateLimited: false,
      error: e instanceof Error ? e.message : String(e),
      fetchedAt,
    };
  }
}

export interface PriceConventionCheck {
  mint: string;
  symbol: string;
  usdPrice: number | null;
  usdPricePrescaled: number | null;
  multiplierUsed: number | null;
  relativeError: number | null;
  passed: boolean | null;
  missing: boolean;
  note?: string;
}

/**
 * For each token with scaledUiConfig (from Jupiter or RPC mint config),
 * assert usdPrice * effectiveMultiplier ≈ usdPricePrescaled.
 */
export function assertPriceConventions(
  prices: JupiterPriceMap,
  mintConfigs?: ReadonlyMap<string, MintScaledConfig>,
  nowSec: number = Math.floor(Date.now() / 1000),
  tolerance: number = PRICE_CONVENTION_TOLERANCE,
): PriceConventionCheck[] {
  const results: PriceConventionCheck[] = [];

  for (const token of UNIVERSE) {
    const entry = prices[token.mint];
    if (!entry || entry.usdPrice == null) {
      results.push({
        mint: token.mint,
        symbol: token.symbol,
        usdPrice: null,
        usdPricePrescaled: null,
        multiplierUsed: null,
        relativeError: null,
        passed: null,
        missing: true,
        note: entry ? 'usdPrice missing' : 'token missing from Jupiter response',
      });
      continue;
    }

    const jupCfg = entry.scaledUiConfig;
    const rpcCfg = mintConfigs?.get(token.mint);

    let multiplierUsed: number | null = null;
    let usdPricePrescaled: number | null =
      jupCfg?.usdPricePrescaled != null
        ? Number(jupCfg.usdPricePrescaled)
        : null;

    if (jupCfg && (jupCfg.multiplier != null || jupCfg.newMultiplier != null)) {
      const like: ScaledUiConfigLike = {
        multiplier: Number(jupCfg.multiplier ?? 1),
        newMultiplier: Number(jupCfg.newMultiplier ?? jupCfg.multiplier ?? 1),
        newMultiplierEffectiveTimestamp: Number(
          jupCfg.newMultiplierEffectiveTimestamp ?? 0,
        ),
      };
      multiplierUsed = effectiveMultiplier(like, nowSec);
    } else if (rpcCfg) {
      multiplierUsed = rpcCfg.effectiveMultiplier;
      // If Jupiter omitted prescaled, derive expected for documentation only —
      // assertion requires both sides; skip if no usdPricePrescaled.
    }

    if (multiplierUsed == null || usdPricePrescaled == null) {
      results.push({
        mint: token.mint,
        symbol: token.symbol,
        usdPrice: entry.usdPrice,
        usdPricePrescaled,
        multiplierUsed,
        relativeError: null,
        passed: null,
        missing: false,
        note:
          multiplierUsed == null
            ? 'no scaledUiConfig (Jupiter or RPC) — skip assert'
            : 'usdPricePrescaled absent — skip assert',
      });
      continue;
    }

    const rel = relativePriceConventionError(
      entry.usdPrice,
      usdPricePrescaled,
      multiplierUsed,
    );
    const passed = rel != null && rel <= tolerance;

    results.push({
      mint: token.mint,
      symbol: token.symbol,
      usdPrice: entry.usdPrice,
      usdPricePrescaled,
      multiplierUsed,
      relativeError: rel,
      passed,
      missing: false,
      note: passed
        ? undefined
        : `convention fail: |usdPrice*m - usdPricePrescaled|/max = ${rel}`,
    });
  }

  return results;
}

export function missingTokens(
  prices: JupiterPriceMap,
): { symbol: string; mint: string }[] {
  return UNIVERSE.filter((t) => !prices[t.mint]).map((t) => ({
    symbol: t.symbol,
    mint: t.mint,
  }));
}

// Re-export for scripts that may not need full universe map
export { UNIVERSE_BY_MINT };
