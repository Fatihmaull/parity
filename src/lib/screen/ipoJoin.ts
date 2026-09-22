import type { IpoBundle } from '@/lib/data/polymarket';

/**
 * Pick a representative "implied months to IPO" per PreStocks symbol
 * from Polymarket ladders (same mid-rung preference as /ipo scatter).
 */
export function impliedMonthsBySymbol(
  bundle: IpoBundle,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const ev of bundle.events) {
    if (!ev.relatedSymbol) continue;
    const candidate =
      ev.markets.find(
        (m) =>
          m.impliedMonthsToIpo != null &&
          m.yesProb != null &&
          m.yesProb > 0.05 &&
          m.yesProb < 0.95,
      ) ??
      ev.markets.find(
        (m) => m.impliedMonthsToIpo != null && m.yesProb != null,
      );
    out.set(
      ev.relatedSymbol,
      candidate?.impliedMonthsToIpo ?? null,
    );
  }
  return out;
}
