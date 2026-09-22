/**
 * Load PreStocks /api/stats with live → snapshot fallback.
 */

import { fetchPrestocksStats } from '@/lib/data/prestocks';
import {
  loadLatestSnapshot,
  snapshotOnly,
  tryLiveThenSnapshot,
} from '@/lib/data/liveOrSnapshot';
import type { PrestocksStatsPayload } from '@/lib/domain';
import type { SnapshotPayload } from '@/lib/data/tokens';

export interface StatsHistoryBundle {
  source: 'live' | 'snapshot' | 'none';
  asOf: string | null;
  stale: boolean;
  snapshotFile?: string;
  error?: string;
  stats: PrestocksStatsPayload | null;
}

function asStats(raw: unknown): PrestocksStatsPayload | null {
  if (raw && typeof raw === 'object') return raw as PrestocksStatsPayload;
  return null;
}

export async function loadStatsHistory(): Promise<StatsHistoryBundle> {
  if (snapshotOnly()) {
    const snap = await loadLatestSnapshot<SnapshotPayload>();
    if (!snap) {
      return {
        source: 'none',
        asOf: null,
        stale: true,
        error: 'SNAPSHOT_ONLY=true and no snapshot',
        stats: null,
      };
    }
    return {
      source: 'snapshot',
      asOf: snap.data.capturedAt ?? null,
      stale: true,
      snapshotFile: snap.file,
      stats: asStats(snap.data.prestocks?.stats),
    };
  }

  const result = await tryLiveThenSnapshot<
    { stats: PrestocksStatsPayload | null; asOf: string },
    SnapshotPayload
  >({
    live: async () => {
      const raw = await fetchPrestocksStats();
      return {
        stats: asStats(raw),
        asOf: new Date().toISOString(),
      };
    },
    fromSnapshot: (snap, _file) => ({
      stats: asStats(snap.prestocks?.stats),
      asOf: snap.capturedAt ?? new Date().toISOString(),
    }),
  });

  if (!result.data) {
    return {
      source: 'none',
      asOf: null,
      stale: true,
      error: result.error,
      snapshotFile: result.snapshotFile,
      stats: null,
    };
  }

  return {
    source: result.source,
    asOf: result.data.asOf,
    stale: result.source === 'snapshot',
    snapshotFile: result.snapshotFile,
    error: result.error,
    stats: result.data.stats,
  };
}
