/**
 * Portfolio valuation conventions for PreStocks Token-2022 ScaledUiAmount.
 *
 * Correct:
 *   uiAmount (RPC, already scaled) × usdPrice
 *   OR rawUnits (amount/10^decimals) × usdPricePrescaled
 *
 * Crossed (bug demos — what naive tools often show):
 *   uiAmount × usdPricePrescaled   → over by m
 *   rawUnits × usdPrice            → under by m
 */

export interface HoldingAmounts {
  /** Atomic amount as integer string from RPC */
  amountRaw: string;
  decimals: number;
  /** RPC uiAmount — ALREADY includes ScaledUiAmount multiplier */
  uiAmount: number | null;
  effectiveMultiplier: number;
}

export interface PricePair {
  /** Per scaled / display unit */
  usdPrice: number | null;
  /** Per raw / 10^decimals unit */
  usdPricePrescaled: number | null;
}

export interface ValuationBreakdown {
  rawUnits: number | null;
  uiAmount: number | null;
  /** Correct: uiAmount × usdPrice */
  valueDisplay: number | null;
  /** Correct alt: rawUnits × usdPricePrescaled */
  valueRawConvention: number | null;
  /** Crossed: uiAmount × usdPricePrescaled (over by ~m) */
  crossedScaledTimesPrescaled: number | null;
  /** Crossed: rawUnits × usdPrice (under by ~m) */
  crossedRawTimesUsdPrice: number | null;
}

export function rawUnitsFromAmount(
  amountRaw: string,
  decimals: number,
): number | null {
  if (!/^\d+$/.test(amountRaw) || !Number.isFinite(decimals) || decimals < 0) {
    return null;
  }
  const raw = Number(amountRaw);
  if (!Number.isFinite(raw)) return null;
  return raw / 10 ** decimals;
}

/**
 * If RPC omitted uiAmount, derive from raw × m (only when uiAmount missing).
 * Prefer RPC uiAmount — never double-apply when present.
 */
export function resolveUiAmount(
  h: HoldingAmounts,
): number | null {
  if (h.uiAmount != null && Number.isFinite(h.uiAmount)) return h.uiAmount;
  const raw = rawUnitsFromAmount(h.amountRaw, h.decimals);
  if (raw == null) return null;
  return raw * h.effectiveMultiplier;
}

export function valueHolding(
  h: HoldingAmounts,
  prices: PricePair,
): ValuationBreakdown {
  const rawUnits = rawUnitsFromAmount(h.amountRaw, h.decimals);
  const uiAmount = resolveUiAmount(h);
  const { usdPrice, usdPricePrescaled } = prices;

  const mul = (a: number | null, b: number | null): number | null =>
    a != null && b != null && Number.isFinite(a) && Number.isFinite(b)
      ? a * b
      : null;

  return {
    rawUnits,
    uiAmount,
    valueDisplay: mul(uiAmount, usdPrice),
    valueRawConvention: mul(rawUnits, usdPricePrescaled),
    crossedScaledTimesPrescaled: mul(uiAmount, usdPricePrescaled),
    crossedRawTimesUsdPrice: mul(rawUnits, usdPrice),
  };
}
