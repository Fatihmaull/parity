import { Suspense } from 'react';
import { AnomalyCards } from '@/components/AnomalyCards';
import { StaleBadge } from '@/components/StaleBadge';
import { TerminalScreen } from '@/components/TerminalScreen';
import { loadTokenBundle } from '@/lib/data/tokens';
import { loadIpoLadders } from '@/lib/data/polymarket';
import { impliedMonthsBySymbol } from '@/lib/screen/ipoJoin';
import type { TokenRow } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function enrichWithIpo(
  rows: TokenRow[],
  monthsBySymbol: Map<string, number | null>,
): TokenRow[] {
  return rows.map((r) => ({
    ...r,
    impliedMonthsToIpo: monthsBySymbol.has(r.symbol)
      ? (monthsBySymbol.get(r.symbol) ?? null)
      : null,
  }));
}

export default async function Home() {
  const [bundle, ipo] = await Promise.all([
    loadTokenBundle(),
    loadIpoLadders().catch(() => null),
  ]);

  const months = ipo
    ? impliedMonthsBySymbol(ipo)
    : new Map<string, number | null>();
  const rows = enrichWithIpo(bundle.rows, months);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-wide">
            Terminal
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
            All PreStocks tokens, sorted by |premium| descending. Premium % ={' '}
            (display price − mark) / mark × 100 — invariant under Display⇄Raw.
            Green / red only for premium. Holders from PreStocks{' '}
            <code className="text-[var(--foreground)]">/api/metrics</code>.
            Screener presets, watchlist, quality score, IPO months, and expand
            rows for convention / cross-venue checks.
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

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No token rows. Run <code>npm run snapshot</code> or unset
          SNAPSHOT_ONLY.
        </p>
      ) : (
        <Suspense
          fallback={
            <p className="font-mono text-xs text-[var(--muted)]">
              Loading screener…
            </p>
          }
        >
          <TerminalScreen
            rows={rows}
            meta={{ asOf: bundle.asOf, stale: bundle.stale }}
          />
        </Suspense>
      )}

      <AnomalyCards rows={rows} />

      <p className="font-mono text-[10px] text-[var(--muted)]">
        Economic exposure via Reg S SPV structures — not ownership. See{' '}
        <a href="/disclosures" className="text-[var(--accent)] hover:underline">
          Disclosures
        </a>
        .
      </p>
    </main>
  );
}
