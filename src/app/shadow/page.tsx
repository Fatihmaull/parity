import { StaleBadge } from '@/components/StaleBadge';
import { loadShadowBoard } from '@/lib/data/shadow';
import { fmtUsdPrice } from '@/lib/format';
import { SHADOW_CANDIDATES } from '@/config/shadow';

export const dynamic = 'force-dynamic';

export default async function ShadowPage() {
  const board = await loadShadowBoard();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-wide">
            Shadow board
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
            Names with PreStocks marks but <strong>no token yet</strong> —
            discover the untokenized pipeline via{' '}
            <code className="text-[var(--foreground)]">
              GET /api/mark-price/batch
            </code>
            . Not tradable here; marks only. Nulls (e.g. CEREBRAS) are skipped.
          </p>
        </div>
        <StaleBadge
          stale={board.source !== 'live'}
          asOf={board.asOf}
          snapshotFile={board.snapshotFile}
        />
      </div>

      {board.error ? (
        <p className="font-mono text-[11px] text-[var(--warn)]">
          {board.error}
        </p>
      ) : null}

      {board.rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No shadow marks. Run live fetch or ensure{' '}
          <code>src/data/snapshot/shadow/latest.json</code> exists under
          SNAPSHOT_ONLY.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium text-right">Mark price</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row, i) => (
                <tr
                  key={row.symbol}
                  className="border-b border-[var(--border)]/60 hover:bg-[var(--row-hover)]"
                >
                  <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--muted)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm font-semibold tracking-wide">
                    {row.symbol}
                  </td>
                  <td className="num px-3 py-2 text-right font-mono tabular-nums">
                    {fmtUsdPrice(row.markPrice)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] uppercase text-[var(--muted)]">
                    mark only · no token
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="font-mono text-[10px] text-[var(--muted)]">
        Candidates scanned: {SHADOW_CANDIDATES.join(', ')}. Skipped nulls:{' '}
        {board.skippedNulls.length > 0
          ? board.skippedNulls.join(', ')
          : 'none'}.
        Framing: research / discovery only — not an offer to buy or sell.
        Economic exposure via Reg S SPV structures when tokens exist — not
        ownership.
      </p>
    </main>
  );
}
