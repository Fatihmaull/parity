import { ConventionCheck } from '@/components/ConventionCheck';
import { StaleBadge } from '@/components/StaleBadge';
import { loadTokenBundle } from '@/lib/data/tokens';

export const dynamic = 'force-dynamic';

export default async function ConventionPage() {
  const bundle = await loadTokenBundle();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-wide">
            Convention Check
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
            Centerpiece: 2×2 matrix for a fixed 1,000-token position. Pair
            scaled amounts with usdPrice; pair raw amounts with
            usdPricePrescaled. Crossing them mis-values by m² (SPACEX m=5 →
            25×).
          </p>
        </div>
        <StaleBadge
          stale={bundle.stale}
          asOf={bundle.asOf}
          snapshotFile={bundle.snapshotFile}
        />
      </div>

      <ConventionCheck rows={bundle.rows} />
    </main>
  );
}
