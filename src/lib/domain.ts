/**
 * PARITY domain model + PreStocks normalizer.
 * Scope: PreStocks-only. Tessera tokens are out of scope.
 *
 * Correctness:
 * - premiumPct is ALWAYS (priceDisplay - markPrice) / markPrice * 100
 *   and is CONVENTION-INVARIANT (Display⇄Raw toggle must not change it).
 * - Mark: prefer PreStocks catalogue markPrice; Jupiter stockData.price fallback.
 * - Holders: prefer /api/metrics holderCount; never silently mix stats series.
 */

import type { Issuer, LegalStructure } from '@/config/universe';
import { UNIVERSE } from '@/config/universe';
import { premiumPct as computePremiumPct } from '@/lib/scaled';
import type { MintScaledConfig } from '@/lib/rpc/mintConfig';
import type { JupiterPriceEntry, JupiterPriceMap } from '@/lib/jupiter/price';

export type { Issuer, LegalStructure };
export type Convention = 'display' | 'raw';

export const ANOMALY_PREMIUM_ABS_PCT = 20;

export interface ScaledConfig {
  decimals: number;
  multiplier: number;
  newMultiplier: number;
  newMultiplierEffectiveTimestamp: number;
  effectiveMultiplier: number;
  hasScaledUiAmount: boolean;
  source: 'rpc' | 'jupiter' | 'none';
}

export interface AnomalyDiagnostics {
  absPremiumPct: number;
  hasScaledUiAmount: boolean;
  effectiveMultiplier: number;
  /** Whether usdPrice * m ≈ mark (within 5%) — rough sanity */
  usdPriceTimesMNearMark: boolean | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  note?: string;
}

export interface TokenRow {
  symbol: string;
  mint: string;
  issuer: Issuer;
  legalStructure: LegalStructure;
  name: string | null;

  /** Per scaled / display unit — used for premium */
  priceDisplay: number | null;
  /** Per raw / 10^decimals unit (usdPricePrescaled or display * m) */
  priceRaw: number | null;
  markPrice: number | null;
  markSource: 'prestocks' | 'jupiter-stockData' | 'none';

  /** Convention-invariant; always from priceDisplay vs markPrice */
  premiumPct: number | null;

  effectiveMultiplier: number;
  scaled: ScaledConfig;

  liquidityUsd: number | null;
  volume24hUsd: number | null;
  volumeSource: 'dexscreener' | 'prestocks-stats' | 'none';
  holders: number | null;
  holdersSource: 'metrics' | 'none';

  anomaly: boolean;
  anomalyDiagnostics: AnomalyDiagnostics | null;

  /* Side-by-side sources for Convention Check */
  prestocksTokenPrice: number | null;
  prestocksMarkPrice: number | null;
  jupiterUsdPrice: number | null;
  jupiterUsdPricePrescaled: number | null;
  jupiterStockDataPrice: number | null;
}

export interface PrestocksCatalogueItem {
  name?: string;
  symbol?: string;
  contract_address?: string;
  markPrice?: number;
  tokenPrice?: number;
  markValuation?: number;
  impliedValuation?: number;
  supply?: number;
  description?: string;
  image?: string;
  external_url?: string;
}

export interface PrestocksMetricItem {
  symbol?: string;
  splMint?: string;
  tokenPrice?: number;
  holderCount?: number;
  marketCapUSD?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  cumulativeVolumeUSD?: number;
  txnCount?: number;
  thirtyDayChange?: number;
}

export interface PrestocksStatsPayload {
  volume?: Array<Record<string, number | string>>;
  holders?: Array<Record<string, number | string>>;
  volumeSymbols?: string[];
  holderSymbols?: string[];
  launchDates?: unknown;
}

export interface PrestocksBundle {
  catalogue: PrestocksCatalogueItem[] | null;
  metrics: { metrics?: PrestocksMetricItem[]; totals?: unknown } | null;
  stats: PrestocksStatsPayload | null;
}

export interface DexPairHint {
  mint: string;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

export interface NormalizeInput {
  prestocks: PrestocksBundle;
  jupiterPrices: JupiterPriceMap;
  mintConfigs: ReadonlyMap<string, MintScaledConfig>;
  dexByMint?: ReadonlyMap<string, DexPairHint>;
  nowSec?: number;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stockDataPrice(entry: JupiterPriceEntry | undefined): number | null {
  const sd = entry?.stockData;
  if (sd && typeof sd === 'object' && sd !== null && 'price' in sd) {
    return num((sd as { price?: unknown }).price);
  }
  return null;
}

function scaledFromRpc(
  rpc: MintScaledConfig | undefined,
  jup: JupiterPriceEntry | undefined,
  nowSec: number,
): ScaledConfig {
  if (rpc) {
    const has =
      rpc.multiplier !== 1 ||
      rpc.newMultiplier !== 1 ||
      rpc.newMultiplierEffectiveTimestamp > 0;
    return {
      decimals: rpc.decimals,
      multiplier: rpc.multiplier,
      newMultiplier: rpc.newMultiplier,
      newMultiplierEffectiveTimestamp: rpc.newMultiplierEffectiveTimestamp,
      effectiveMultiplier: rpc.effectiveMultiplier,
      hasScaledUiAmount: has,
      source: 'rpc',
    };
  }

  const cfg = jup?.scaledUiConfig;
  if (cfg && (cfg.multiplier != null || cfg.newMultiplier != null)) {
    const multiplier = Number(cfg.multiplier ?? 1);
    const newMultiplier = Number(cfg.newMultiplier ?? multiplier);
    const tsRaw =
      (cfg as { newMultiplierEffectiveTimestamp?: number | string })
        .newMultiplierEffectiveTimestamp ??
      (cfg as { newMultiplierEffectiveAt?: string }).newMultiplierEffectiveAt;
    let ts = 0;
    if (typeof tsRaw === 'number') ts = tsRaw;
    else if (typeof tsRaw === 'string') {
      const asNum = Number(tsRaw);
      if (Number.isFinite(asNum) && asNum > 1e9) ts = asNum;
      else {
        const ms = Date.parse(tsRaw);
        if (Number.isFinite(ms)) ts = Math.floor(ms / 1000);
      }
    }
    const effective =
      Number.isFinite(ts) && nowSec >= ts ? newMultiplier : multiplier;
    return {
      decimals: jup?.decimals ?? 9,
      multiplier,
      newMultiplier,
      newMultiplierEffectiveTimestamp: ts,
      effectiveMultiplier: effective,
      hasScaledUiAmount: true,
      source: 'jupiter',
    };
  }

  return {
    decimals: jup?.decimals ?? 9,
    multiplier: 1,
    newMultiplier: 1,
    newMultiplierEffectiveTimestamp: 0,
    effectiveMultiplier: 1,
    hasScaledUiAmount: false,
    source: 'none',
  };
}

/**
 * Approximate 24h volume from PreStocks stats.volume series.
 * Series appears cumulative USD — use day-over-day delta when possible.
 */
export function latestStatsVolume(
  stats: PrestocksStatsPayload | null | undefined,
  symbol: string,
): number | null {
  const rows = stats?.volume;
  if (!rows || rows.length === 0) return null;
  // Walk from end for last two finite points
  let last: number | null = null;
  let prev: number | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = num(rows[i]?.[symbol]);
    if (v == null) continue;
    if (last == null) {
      last = v;
      continue;
    }
    prev = v;
    break;
  }
  if (last == null) return null;
  if (prev != null && last >= prev) return last - prev;
  // If series looks like a single-day / non-cumulative point, return last
  return last;
}

/**
 * Price shown for a convention. Premium is never derived from this alone —
 * always use TokenRow.premiumPct (display-based).
 */
export function priceForConvention(
  row: TokenRow,
  convention: Convention,
): number | null {
  return convention === 'display' ? row.priceDisplay : row.priceRaw;
}

/**
 * Mark shown for a convention. Raw scales mark by effective multiplier so
 * (priceRaw - markRaw) / markRaw === premiumPct (same %).
 */
export function markForConvention(
  row: TokenRow,
  convention: Convention,
): number | null {
  if (row.markPrice == null) return null;
  if (convention === 'display') return row.markPrice;
  return row.markPrice * row.effectiveMultiplier;
}

export function normalizeTokenRows(input: NormalizeInput): TokenRow[] {
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  const catalogueByMint = new Map<string, PrestocksCatalogueItem>();
  const catalogueBySymbol = new Map<string, PrestocksCatalogueItem>();
  for (const item of input.prestocks.catalogue ?? []) {
    if (item.contract_address) catalogueByMint.set(item.contract_address, item);
    if (item.symbol) catalogueBySymbol.set(item.symbol, item);
  }

  const metricsByMint = new Map<string, PrestocksMetricItem>();
  const metricsBySymbol = new Map<string, PrestocksMetricItem>();
  for (const m of input.prestocks.metrics?.metrics ?? []) {
    if (m.splMint) metricsByMint.set(m.splMint, m);
    if (m.symbol) metricsBySymbol.set(m.symbol, m);
  }

  const rows: TokenRow[] = [];

  for (const u of UNIVERSE) {
    const cat =
      catalogueByMint.get(u.mint) ?? catalogueBySymbol.get(u.symbol) ?? null;
    const met =
      metricsByMint.get(u.mint) ?? metricsBySymbol.get(u.symbol) ?? null;
    const jup = input.jupiterPrices[u.mint];
    const rpc = input.mintConfigs.get(u.mint);
    const dex = input.dexByMint?.get(u.mint);
    const scaled = scaledFromRpc(rpc, jup, nowSec);
    const m = scaled.effectiveMultiplier;

    const prestocksMark = num(cat?.markPrice);
    const jupStock = stockDataPrice(jup);
    let markPrice: number | null = null;
    let markSource: TokenRow['markSource'] = 'none';
    if (prestocksMark != null) {
      markPrice = prestocksMark;
      markSource = 'prestocks';
    } else if (jupStock != null) {
      markPrice = jupStock;
      markSource = 'jupiter-stockData';
    }

    const jupiterUsdPrice = num(jup?.usdPrice);
    const jupiterUsdPricePrescaled = num(
      jup?.scaledUiConfig?.usdPricePrescaled,
    );
    const prestocksTokenPrice = num(cat?.tokenPrice) ?? num(met?.tokenPrice);

    // Display price: prefer Jupiter usdPrice (pairs with scaled), else catalogue tokenPrice
    const priceDisplay = jupiterUsdPrice ?? prestocksTokenPrice;
    const priceRaw =
      jupiterUsdPricePrescaled ??
      (priceDisplay != null ? priceDisplay * m : null);

    const premium = computePremiumPct(
      priceDisplay ?? NaN,
      markPrice ?? NaN,
    );

    const holders =
      met?.holderCount != null && Number.isFinite(met.holderCount)
        ? met.holderCount
        : null;

    const liquidityUsd =
      dex?.liquidityUsd ?? num(jup?.liquidity) ?? null;

    let volume24hUsd: number | null = dex?.volume24hUsd ?? null;
    let volumeSource: TokenRow['volumeSource'] = dex?.volume24hUsd != null
      ? 'dexscreener'
      : 'none';
    if (volume24hUsd == null) {
      const fromStats = latestStatsVolume(input.prestocks.stats, u.symbol);
      if (fromStats != null) {
        volume24hUsd = fromStats;
        volumeSource = 'prestocks-stats';
      }
    }

    const absPrem = premium != null ? Math.abs(premium) : null;
    const anomaly = absPrem != null && absPrem > ANOMALY_PREMIUM_ABS_PCT;

    let usdPriceTimesMNearMark: boolean | null = null;
    if (priceDisplay != null && markPrice != null && m > 0) {
      // Diagnostic: does display price * m land near mark? (usually no — different units)
      // More useful: does display ≈ mark?
      const rel = Math.abs(priceDisplay - markPrice) / Math.max(Math.abs(markPrice), 1e-12);
      usdPriceTimesMNearMark = Math.abs(priceDisplay * m - markPrice) / Math.max(Math.abs(markPrice), 1e-12) < 0.05
        ? true
        : rel < 0.05
          ? false
          : false;
      // Clarify: whether usdPrice * m ≈ mark (false for SPACEX discount case)
      usdPriceTimesMNearMark =
        Math.abs(priceDisplay * m - markPrice) /
          Math.max(Math.abs(markPrice), 1e-12) <
        0.05;
    }

    const anomalyDiagnostics: AnomalyDiagnostics | null = anomaly
      ? {
          absPremiumPct: absPrem!,
          hasScaledUiAmount: scaled.hasScaledUiAmount,
          effectiveMultiplier: m,
          usdPriceTimesMNearMark,
          liquidityUsd,
          volume24hUsd,
          note:
            m !== 1
              ? `ScaledUiAmount m=${m}; premium uses display price vs mark (convention-invariant).`
              : `No active scale (m=1); |premium| ${absPrem!.toFixed(1)}% exceeds ${ANOMALY_PREMIUM_ABS_PCT}% threshold.`,
        }
      : null;

    rows.push({
      symbol: u.symbol,
      mint: u.mint,
      issuer: u.issuer,
      legalStructure: u.legalStructure,
      name: cat?.name ?? null,
      priceDisplay,
      priceRaw,
      markPrice,
      markSource,
      premiumPct: premium,
      effectiveMultiplier: m,
      scaled,
      liquidityUsd,
      volume24hUsd,
      volumeSource,
      holders,
      holdersSource: holders != null ? 'metrics' : 'none',
      anomaly,
      anomalyDiagnostics,
      prestocksTokenPrice,
      prestocksMarkPrice: prestocksMark,
      jupiterUsdPrice,
      jupiterUsdPricePrescaled,
      jupiterStockDataPrice: jupStock,
    });
  }

  return rows.sort(
    (a, b) => Math.abs(b.premiumPct ?? 0) - Math.abs(a.premiumPct ?? 0),
  );
}
