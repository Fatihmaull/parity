import type { TokenRow } from '@/lib/domain';

export type ScreenerPresetId =
  | 'all'
  | 'discount10'
  | 'premium20'
  | 'scaled'
  | 'liq250k';

export interface ScreenerPreset {
  id: ScreenerPresetId;
  label: string;
  short: string;
  description: string;
  match: (row: TokenRow) => boolean;
}

export const SCREENER_PRESETS: readonly ScreenerPreset[] = [
  {
    id: 'all',
    label: 'All',
    short: 'all',
    description: 'Clear filters — full PreStocks universe',
    match: () => true,
  },
  {
    id: 'discount10',
    label: 'Discount >10%',
    short: 'disc>10%',
    description: 'premiumPct < −10%',
    match: (r) => r.premiumPct != null && r.premiumPct < -10,
  },
  {
    id: 'premium20',
    label: 'Premium >20% flagged',
    short: 'prem>20%',
    description: '|premium| anomaly band — premiumPct > +20%',
    match: (r) => r.premiumPct != null && r.premiumPct > 20,
  },
  {
    id: 'scaled',
    label: 'm ≠ 1 (split-aware)',
    short: 'm≠1',
    description: 'Active ScaledUiAmount effective multiplier ≠ 1',
    match: (r) => r.effectiveMultiplier !== 1,
  },
  {
    id: 'liq250k',
    label: 'Liq >$250k',
    short: 'liq>$250k',
    description: 'liquidityUsd > 250_000',
    match: (r) => r.liquidityUsd != null && r.liquidityUsd > 250_000,
  },
] as const;

export function presetById(id: string | null | undefined): ScreenerPreset {
  return (
    SCREENER_PRESETS.find((p) => p.id === id) ?? SCREENER_PRESETS[0]!
  );
}

export function applyPreset(
  rows: TokenRow[],
  presetId: ScreenerPresetId,
): TokenRow[] {
  const preset = presetById(presetId);
  return rows.filter(preset.match);
}

export function applySymbolFilter(
  rows: TokenRow[],
  symbols: string[] | null,
): TokenRow[] {
  if (!symbols || symbols.length === 0) return rows;
  const set = new Set(symbols.map((s) => s.toUpperCase()));
  return rows.filter((r) => set.has(r.symbol.toUpperCase()));
}
