import { AnomalyCards } from '@/components/AnomalyCards';
import { StaleBadge } from '@/components/StaleBadge';
import { TerminalTable } from '@/components/TerminalTable';
import { loadTokenBundle } from '@/lib/data/tokens';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const bundle = await loadTokenBundle();

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

      {bundle.rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No token rows. Run <code>npm run snapshot</code> or unset
          SNAPSHOT_ONLY.
        </p>
      ) : (
        <div className="rounded border border-[var(--border)] bg-[var(--panel)]">
          <TerminalTable rows={bundle.rows} />
        </div>
      )}

      <AnomalyCards rows={bundle.rows} />

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
