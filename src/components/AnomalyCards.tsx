import type { TokenRow } from '@/lib/domain';
import { fmtMult, fmtPct, fmtUsd } from '@/lib/format';

export function AnomalyCards({ rows }: { rows: TokenRow[] }) {
  const flagged = rows.filter((r) => r.anomaly);
  if (flagged.length === 0) {
    return (
      <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          Anomaly flags
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No tokens with |premium| &gt; 20% in the current dataset.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
        Anomaly flags · |premium| &gt; 20%
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {flagged.map((row) => {
          const d = row.anomalyDiagnostics!;
          return (
            <article
              key={row.mint}
              className="rounded border border-[var(--negative)]/30 bg-[var(--panel)] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-mono text-sm font-semibold tracking-wide">
                  {row.symbol}
                </h3>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    (row.premiumPct ?? 0) >= 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--negative)]'
                  }`}
                >
                  {fmtPct(row.premiumPct)}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                <li>
                  ScaledUiAmount?{' '}
                  <span className="text-[var(--foreground)]">
                    {d.hasScaledUiAmount ? 'yes' : 'no'}
                  </span>
                </li>
                <li>
                  Effective multiplier{' '}
                  <span className="text-[var(--foreground)] tabular-nums">
                    {fmtMult(d.effectiveMultiplier)}
                  </span>
                </li>
                <li>
                  usdPrice × m ≈ mark?{' '}
                  <span className="text-[var(--foreground)]">
                    {d.usdPriceTimesMNearMark == null
                      ? 'n/a'
                      : d.usdPriceTimesMNearMark
                        ? 'yes'
                        : 'no'}
                  </span>
                </li>
                <li>
                  Liquidity{' '}
                  <span className="text-[var(--foreground)] tabular-nums">
                    {fmtUsd(d.liquidityUsd, 0)}
                  </span>
                </li>
                <li>
                  Volume hint{' '}
                  <span className="text-[var(--foreground)] tabular-nums">
                    {fmtUsd(d.volume24hUsd, 0)}
                  </span>
                </li>
              </ul>
              {d.note ? (
                <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
                  {d.note}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
