/**
 * ScaledUiAmount conversion helpers (pure, no I/O).
 *
 * Correctness rules:
 * - RPC `uiAmount` ALREADY includes the effective multiplier — never double-apply.
 * - Past/at `newMultiplierEffectiveTimestamp` → use `newMultiplier` (`>=` rule).
 *
 * Convention:
 * - `usdPrice` pairs with scaled (display) amounts.
 * - `usdPricePrescaled` pairs with raw token amounts / 10^decimals (pre-multiplier).
 *   Relation (when scaledUiConfig present):
 *     usdPrice * effectiveMultiplier ≈ usdPricePrescaled  (within ~0.1%)
 */

export interface ScaledUiConfigLike {
  multiplier: number;
  newMultiplier: number;
  /** Unix seconds (number or bigint) */
  newMultiplierEffectiveTimestamp: number | bigint;
}

/**
 * Effective multiplier at `nowSec` (unix seconds).
 * Uses `>=` on newMultiplierEffectiveTimestamp (past or exactly at → newMultiplier).
 */
export function effectiveMultiplier(
  cfg: ScaledUiConfigLike,
  nowSec: number,
): number {
  const effectiveAt = Number(cfg.newMultiplierEffectiveTimestamp);
  if (Number.isFinite(effectiveAt) && nowSec >= effectiveAt) {
    return cfg.newMultiplier;
  }
  return cfg.multiplier;
}

/**
 * Premium of display/token price vs mark price, as a percent.
 * premiumPct = (priceDisplay / markPrice - 1) * 100
 * Returns null if inputs are non-finite or markPrice is 0.
 */
export function premiumPct(
  priceDisplay: number,
  markPrice: number,
): number | null {
  if (
    !Number.isFinite(priceDisplay) ||
    !Number.isFinite(markPrice) ||
    markPrice === 0
  ) {
    return null;
  }
  return (priceDisplay / markPrice - 1) * 100;
}

/** Raw atomic amount → display (scaled) amount using effective multiplier. */
export function rawToDisplayAmount(
  rawAmount: number | bigint,
  decimals: number,
  multiplier: number,
): number {
  const raw = typeof rawAmount === 'bigint' ? Number(rawAmount) : rawAmount;
  return (raw / 10 ** decimals) * multiplier;
}

/** Display (scaled) amount → raw atomic amount. Inverse of rawToDisplayAmount. */
export function displayToRawAmount(
  displayAmount: number,
  decimals: number,
  multiplier: number,
): number {
  if (multiplier === 0) return NaN;
  return (displayAmount / multiplier) * 10 ** decimals;
}

/**
 * Convert usdPrice (per scaled unit) → usdPricePrescaled (per raw/10^decimals unit).
 * usdPricePrescaled = usdPrice * effectiveMultiplier
 */
export function usdPriceToPrescaled(
  usdPrice: number,
  multiplier: number,
): number {
  return usdPrice * multiplier;
}

/**
 * Convert usdPricePrescaled → usdPrice.
 * usdPrice = usdPricePrescaled / effectiveMultiplier
 */
export function usdPricePrescaledToPrice(
  usdPricePrescaled: number,
  multiplier: number,
): number {
  if (multiplier === 0) return NaN;
  return usdPricePrescaled / multiplier;
}

/**
 * Assert Jupiter convention: usdPrice * m ≈ usdPricePrescaled.
 * Returns relative absolute error, or null if inputs unusable.
 */
export function relativePriceConventionError(
  usdPrice: number,
  usdPricePrescaled: number,
  multiplier: number,
): number | null {
  if (
    !Number.isFinite(usdPrice) ||
    !Number.isFinite(usdPricePrescaled) ||
    !Number.isFinite(multiplier) ||
    multiplier === 0
  ) {
    return null;
  }
  const expected = usdPrice * multiplier;
  if (expected === 0 && usdPricePrescaled === 0) return 0;
  const denom = Math.max(Math.abs(expected), Math.abs(usdPricePrescaled), 1e-12);
  return Math.abs(expected - usdPricePrescaled) / denom;
}

export const PRICE_CONVENTION_TOLERANCE = 1e-4; // 0.01% absolute relative ≈ 0.1% with margin
