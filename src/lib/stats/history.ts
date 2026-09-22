/**
 * PreStocks /api/stats series helpers.
 * Volume rows are cumulative USD — daily volume = day-over-day difference.
 * Holders rows are weekly point-in-time counts (NOT metrics.holderCount).
 * Never mix holder series with /api/metrics in one chart.
 */

import type { PrestocksStatsPayload } from '@/lib/domain';
import { UNIVERSE } from '@/config/universe';

export const STATS_SYMBOLS: readonly string[] = UNIVERSE.map((t) => t.symbol);

export type StatsPoint = Record<string, string | number | null | undefined> & {
  date?: string;
  week?: string;
};

export interface ChartRow {
  /** ISO date or week start (YYYY-MM-DD) */
  t: string;
  /** Per-symbol numeric values */
  [symbol: string]: string | number | null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function keyOf(row: StatsPoint): string | null {
  const k = row.date ?? row.week;
  if (typeof k === 'string' && k.length > 0) return k;
  return null;
}

/** Cumulative volume series from stats.volume (as stored by PreStocks). */
export function cumulativeVolumeSeries(
  stats: PrestocksStatsPayload | null | undefined,
  symbols: readonly string[] = STATS_SYMBOLS,
): ChartRow[] {
  const rows = stats?.volume;
  if (!rows?.length) return [];
  const out: ChartRow[] = [];
  for (const row of rows) {
    const t = keyOf(row as StatsPoint);
    if (!t) continue;
    const point: ChartRow = { t };
    for (const s of symbols) {
      point[s] = num((row as StatsPoint)[s]);
    }
    out.push(point);
  }
  return out;
}

/**
 * Daily volume by differencing consecutive cumulative points.
 * Negative deltas (rare resets / corrections) are floored at 0 for stacked charts.
 */
export function dailyVolumeSeries(
  stats: PrestocksStatsPayload | null | undefined,
  symbols: readonly string[] = STATS_SYMBOLS,
  opts?: { floorAtZero?: boolean },
): ChartRow[] {
  const floor = opts?.floorAtZero !== false;
  const cum = cumulativeVolumeSeries(stats, symbols);
  if (cum.length < 2) return [];
  const out: ChartRow[] = [];
  for (let i = 1; i < cum.length; i++) {
    const prev = cum[i - 1]!;
    const cur = cum[i]!;
    const point: ChartRow = { t: cur.t };
    for (const s of symbols) {
      const a = num(prev[s]);
      const b = num(cur[s]);
      if (a == null || b == null) {
        point[s] = null;
        continue;
      }
      const d = b - a;
      point[s] = floor ? Math.max(0, d) : d;
    }
    out.push(point);
  }
  return out;
}

/** Weekly holder growth from stats.holders — source: PreStocks /api/stats only. */
export function holdersSeries(
  stats: PrestocksStatsPayload | null | undefined,
  symbols: readonly string[] = STATS_SYMBOLS,
): ChartRow[] {
  const rows = stats?.holders;
  if (!rows?.length) return [];
  const out: ChartRow[] = [];
  for (const row of rows) {
    const t = keyOf(row as StatsPoint);
    if (!t) continue;
    const point: ChartRow = { t };
    for (const s of symbols) {
      point[s] = num((row as StatsPoint)[s]);
    }
    out.push(point);
  }
  return out;
}

/** Keep last N points (or all if n <= 0). */
export function tailSeries(rows: ChartRow[], n: number): ChartRow[] {
  if (n <= 0 || rows.length <= n) return rows;
  return rows.slice(rows.length - n);
}

/** Dense downsample: keep every k-th point plus last. */
export function downsample(rows: ChartRow[], maxPoints: number): ChartRow[] {
  if (rows.length <= maxPoints || maxPoints < 2) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  const out: ChartRow[] = [];
  for (let i = 0; i < rows.length; i += step) {
    out.push(rows[i]!);
  }
  const last = rows[rows.length - 1]!;
  if (out[out.length - 1]?.t !== last.t) out.push(last);
  return out;
}

export const SYMBOL_COLORS: Record<string, string> = {
  ANTHROPIC: '#2a6f97',
  OPENAI: '#1a7f4b',
  SPACEX: '#9a6700',
  ANDURIL: '#b42318',
  KALSHI: '#6b5b95',
  NEURALINK: '#5ba4cb',
  POLYMARKET: '#c45c26',
  FIGUREAI: '#3d7a6a',
  XAI: '#8a9bab',
};
