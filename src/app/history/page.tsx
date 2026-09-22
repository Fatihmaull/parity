import { HistoryCharts } from '@/components/HistoryCharts';
import { StaleBadge } from '@/components/StaleBadge';
import { loadStatsHistory } from '@/lib/data/statsHistory';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const bundle = await loadStatsHistory();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-wide">
            History
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
            PreStocks <code className="text-[var(--foreground)]">/api/stats</code>{' '}
            only — cumulative volume, daily volume via differencing, and weekly
            holder growth. Holder series is never mixed with{' '}
            <code className="text-[var(--foreground)]">/api/metrics</code>{' '}
            holderCount.
          </p>
        </div>
        <StaleBadge
          stale={bundle.stale}
          asOf={bundle.asOf}
          snapshotFile={bundle.snapshotFile}
        />
      </div>

      {bundle.error && bundle.source !== 'live' ? (
        <p className="font-mono text-[11px] text-[var(--warn)]">
          {bundle.error}
        </p>
      ) : null}

      {!bundle.stats?.volume?.length ? (
        <p className="text-sm text-[var(--muted)]">
          No stats series available. Run <code>npm run snapshot</code> or unset
          SNAPSHOT_ONLY.
        </p>
      ) : (
        <HistoryCharts stats={bundle.stats} />
      )}

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
