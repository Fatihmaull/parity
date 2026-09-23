import { StaleBadge } from '@/components/StaleBadge';
import { loadTokenBundle } from '@/lib/data/tokens';
import { fmtMult, fmtPct } from '@/lib/format';

export const dynamic = 'force-dynamic';

function fmtTs(sec: number): string {
  if (!sec || sec <= 0) return '—';
  try {
    return (
      new Date(sec * 1000).toLocaleString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' WIB'
    );
  } catch {
    return String(sec);
  }
}

export default async function SplitsPage() {
  const bundle = await loadTokenBundle();
  const scaled = bundle.rows.filter(
    (r) =>
      r.scaled.hasScaledUiAmount ||
      r.effectiveMultiplier !== 1 ||
      r.scaled.multiplier !== 1 ||
      r.scaled.newMultiplier !== 1,
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-wide">
            Split / multiplier timeline
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
            Token-2022 ScaledUiAmount configs for PreStocks. Effective
            multiplier uses <code className="text-[var(--foreground)]">≥</code>{' '}
            on <code className="text-[var(--foreground)]">newMultiplierEffectiveTimestamp</code>.
            Highlight: <strong>SPACEX ×5</strong>,{' '}
            <strong>OPENAI ≈1.486</strong>.
          </p>
        </div>
        <StaleBadge
          stale={bundle.stale}
          partialStale={bundle.partialStale}
          asOf={bundle.asOf}
          snapshotFile={bundle.snapshotFile}
          warnings={bundle.warnings}
        />
      </div>

      {bundle.stale && bundle.error ? (
        <p className="font-mono text-[11px] text-[var(--warn)]">
          {bundle.error}
        </p>
      ) : null}
      {bundle.partialStale && bundle.warnings?.length ? (
        <p className="font-mono text-[11px] text-[var(--accent)]">
          {bundle.warnings.join(' · ')}
        </p>
      ) : null}

      {scaled.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No ScaledUiAmount tokens in current dataset (SNAPSHOT_ONLY or empty
          universe).
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium text-right">multiplier</th>
                <th className="px-3 py-2 font-medium text-right">
                  newMultiplier
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  effectiveAt
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  current effective
                </th>
                <th className="px-3 py-2 font-medium text-right">Premium</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {scaled.map((row) => {
                const highlight =
                  row.symbol === 'SPACEX' || row.symbol === 'OPENAI';
                const prem = row.premiumPct;
                const premClass =
                  prem == null
                    ? 'text-[var(--muted)]'
                    : prem > 0
                      ? 'text-[var(--positive)]'
                      : prem < 0
                        ? 'text-[var(--negative)]'
                        : '';
                return (
                  <tr
                    key={row.mint}
                    className={`border-b border-[var(--border)]/60 ${
                      highlight
                        ? 'bg-[var(--accent-muted)]/40'
                        : 'hover:bg-[var(--row-hover)]'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono text-sm font-semibold tracking-wide">
                        {row.symbol}
                      </span>
                      {highlight ? (
                        <span className="ml-2 rounded border border-[var(--accent)]/40 px-1 py-px font-mono text-[9px] uppercase text-[var(--accent)]">
                          highlight
                        </span>
                      ) : null}
                    </td>
                    <td className="num px-3 py-2 text-right font-mono tabular-nums">
                      {fmtMult(row.scaled.multiplier)}
                    </td>
                    <td className="num px-3 py-2 text-right font-mono tabular-nums">
                      {fmtMult(row.scaled.newMultiplier)}
                    </td>
                    <td className="num px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">
                      {fmtTs(row.scaled.newMultiplierEffectiveTimestamp)}
                    </td>
                    <td className="num px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
                      {fmtMult(row.effectiveMultiplier)}
                    </td>
                    <td
                      className={`num px-3 py-2 text-right font-mono tabular-nums ${premClass}`}
                    >
                      {fmtPct(prem)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] uppercase text-[var(--muted)]">
                      {row.scaled.source}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-4 text-xs leading-relaxed text-[var(--muted)]">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground)]">
          Notes
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong className="text-[var(--foreground)]">SPACEX</strong>:
            on-chain multiplier=1 → newMultiplier=5; effective since 2026-06-10
            → <span className="tabular-nums text-[var(--accent)]">5×</span>.
          </li>
          <li>
            <strong className="text-[var(--foreground)]">OPENAI</strong>:
            newMultiplier ≈ 1.4861347 effective since 2026-07-17.
          </li>
          <li>
            Premium % on this page is still convention-invariant (display vs
            mark). Economic exposure via Reg S SPV — not ownership.
          </li>
        </ul>
      </section>
    </main>
  );
}
