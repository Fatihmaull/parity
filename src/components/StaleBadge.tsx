export function StaleBadge({
  stale,
  partialStale,
  asOf,
  snapshotFile,
  warnings,
}: {
  stale: boolean;
  /** Live primary data with secondary sources from snapshot. */
  partialStale?: boolean;
  asOf: string | null;
  snapshotFile?: string;
  warnings?: string[];
}) {
  if (stale) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--warn)]"
        title={snapshotFile ? `Snapshot: ${snapshotFile}` : undefined}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
        stale snapshot
        {asOf ? (
          <span className="normal-case tracking-normal opacity-80">
            asOf {formatAsOf(asOf)}
          </span>
        ) : null}
      </span>
    );
  }

  if (partialStale) {
    const tip =
      warnings && warnings.length > 0
        ? warnings.join('\n')
        : snapshotFile
          ? `Partial snapshot fill: ${snapshotFile}`
          : 'Some secondary sources filled from snapshot';
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]"
        title={tip}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        partial
        {asOf ? (
          <span className="normal-case tracking-normal opacity-80">
            {formatAsOf(asOf)}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
      live
      {asOf ? (
        <span className="text-[var(--muted)] normal-case tracking-normal">
          {formatAsOf(asOf)}
        </span>
      ) : null}
    </span>
  );
}

function formatAsOf(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleString('en-GB', {
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
    return iso;
  }
}
