/**
 * Liquidity / volume quality score (0–100).
 * Helps judge whether a discount is meaningful vs thin-market noise.
 *
 * Formula (documented in UI tooltip):
 *   score = round(0.45·liq + 0.35·vol + 0.20·holders)
 * where each component is a log10 ramp capped at 100:
 *   liq:     $1 → ~0,  $1,000,000 → 100
 *   vol24h:  $1 → ~0,  $500,000   → 100
 *   holders: 1 → ~0,  10,000      → 100
 * Missing inputs contribute 0 for that component (still averaged with weights).
 */

export const QUALITY_FORMULA_TOOLTIP =
  'Quality 0–100 = 0.45·liq + 0.35·vol24h + 0.20·holders. ' +
  'Each leg is log₁₀-scaled: liq $1M=100, vol $500k=100, holders 10k=100. Missing → 0.';

function logRamp(value: number | null | undefined, fullAt: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  const n = Math.log10(value + 1) / Math.log10(fullAt + 1);
  return Math.max(0, Math.min(100, n * 100));
}

export function liquidityQualityScore(input: {
  liquidityUsd: number | null | undefined;
  volume24hUsd: number | null | undefined;
  holders: number | null | undefined;
}): number {
  const liq = logRamp(input.liquidityUsd, 1_000_000);
  const vol = logRamp(input.volume24hUsd, 500_000);
  const hold = logRamp(input.holders, 10_000);
  return Math.round(0.45 * liq + 0.35 * vol + 0.2 * hold);
}
