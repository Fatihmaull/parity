/**
 * Convention-safe compare: what other screeners show if they mix units.
 * Correct premium is ALWAYS (priceDisplay − mark) / mark.
 * Misleading = treat priceRaw (usdPricePrescaled) as if it were display vs unscaled mark.
 */

import { premiumPct } from '@/lib/scaled';
import type { TokenRow } from '@/lib/domain';

export interface MisleadingPremium {
  /** Correct, convention-invariant premium % */
  correctPct: number | null;
  /**
   * (priceRaw − markDisplay) / markDisplay × 100 —
   * classic wrong-screener reading when ScaledUiAmount m ≠ 1.
   */
  crossedPct: number | null;
  /** Meaningful only when m ≠ 1 and both prices exist */
  differs: boolean;
}

export function misleadingPremium(row: TokenRow): MisleadingPremium {
  const correctPct = row.premiumPct;
  const crossedPct =
    row.priceRaw != null && row.markPrice != null
      ? premiumPct(row.priceRaw, row.markPrice)
      : null;
  const differs =
    row.effectiveMultiplier !== 1 &&
    correctPct != null &&
    crossedPct != null &&
    Math.abs(correctPct - crossedPct) > 0.05;
  return { correctPct, crossedPct, differs };
}
