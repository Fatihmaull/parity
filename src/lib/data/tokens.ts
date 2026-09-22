/**
 * Assemble TokenRow[] from PreStocks + Jupiter + RPC (+ optional DexScreener).
 * Prefer live; SNAPSHOT_ONLY / failure → src/data/snapshot/latest.json.
 */

import { UNIVERSE_MINTS } from '@/config/universe';
import {
  fetchPrestocksCatalogue,
  fetchPrestocksMetrics,
  fetchPrestocksStats,
} from '@/lib/data/prestocks';
import {
  loadLatestSnapshot,
  snapshotOnly,
  tryLiveThenSnapshot,
} from '@/lib/data/liveOrSnapshot';
import { fetchDexScreenerHints } from '@/lib/data/dexscreener';
import { fetchJupiterPrices, type JupiterPriceMap } from '@/lib/jupiter/price';
import {
  fetchAllMintScaledConfigs,
  type MintScaledConfig,
} from '@/lib/rpc/mintConfig';
import {
  normalizeTokenRows,
  type PrestocksBundle,
  type TokenRow,
  type DexPairHint,
} from '@/lib/domain';

export interface SnapshotPayload {
  capturedAt?: string;
  prestocks?: {
    catalogue?: unknown;
    metrics?: unknown;
    stats?: unknown;
  };
  jupiter?: {
    prices?: JupiterPriceMap;
  } | null;
  mintConfigs?: {
    ok?: MintScaledConfig[];
  } | null;
  dexscreener?: { byMint?: Record<string, DexPairHint> } | null;
}

export interface TokenBundle {
  source: 'live' | 'snapshot' | 'none';
  asOf: string | null;
  stale: boolean;
  snapshotFile?: string;
  error?: string;
  rows: TokenRow[];
}

function asCatalogue(raw: unknown): PrestocksBundle['catalogue'] {
  if (Array.isArray(raw)) return raw as PrestocksBundle['catalogue'];
  return null;
}

function asMetrics(raw: unknown): PrestocksBundle['metrics'] {
  if (raw && typeof raw === 'object') {
    return raw as PrestocksBundle['metrics'];
  }
  return null;
}

function asStats(raw: unknown): PrestocksBundle['stats'] {
  if (raw && typeof raw === 'object') {
    return raw as PrestocksBundle['stats'];
  }
  return null;
}

function mintMapFromSnapshot(
  snap: SnapshotPayload,
): Map<string, MintScaledConfig> {
  const map = new Map<string, MintScaledConfig>();
  for (const c of snap.mintConfigs?.ok ?? []) {
    map.set(c.mint, c);
  }
  return map;
}

function dexMapFromSnapshot(
  snap: SnapshotPayload,
): Map<string, DexPairHint> | undefined {
  const by = snap.dexscreener?.byMint;
  if (!by) return undefined;
  return new Map(Object.entries(by));
}

async function liveAssemble(): Promise<{
  rows: TokenRow[];
  asOf: string;
} | null> {
  const [catalogue, metrics, stats, jupiter, mintRes] = await Promise.all([
    fetchPrestocksCatalogue(),
    fetchPrestocksMetrics(),
    fetchPrestocksStats(),
    fetchJupiterPrices(),
    fetchAllMintScaledConfigs(UNIVERSE_MINTS),
  ]);

  if (!jupiter.ok && Object.keys(jupiter.prices).length === 0) {
    // still proceed if we have prestocks; prices may be sparse
  }

  let dexByMint: Map<string, DexPairHint> | undefined;
  try {
    dexByMint = await fetchDexScreenerHints(UNIVERSE_MINTS);
    if (dexByMint.size === 0) dexByMint = undefined;
  } catch {
    dexByMint = undefined;
  }

  const mintConfigs = new Map<string, MintScaledConfig>();
  for (const c of mintRes.ok) mintConfigs.set(c.mint, c);

  const rows = normalizeTokenRows({
    prestocks: {
      catalogue: asCatalogue(catalogue),
      metrics: asMetrics(metrics),
      stats: asStats(stats),
    },
    jupiterPrices: jupiter.prices ?? {},
    mintConfigs,
    dexByMint,
  });

  return { rows, asOf: new Date().toISOString() };
}

function fromSnapshot(
  snap: SnapshotPayload,
  file: string,
): { rows: TokenRow[]; asOf: string; snapshotFile: string } | null {
  const rows = normalizeTokenRows({
    prestocks: {
      catalogue: asCatalogue(snap.prestocks?.catalogue),
      metrics: asMetrics(snap.prestocks?.metrics),
      stats: asStats(snap.prestocks?.stats),
    },
    jupiterPrices: snap.jupiter?.prices ?? {},
    mintConfigs: mintMapFromSnapshot(snap),
    dexByMint: dexMapFromSnapshot(snap),
  });
  return {
    rows,
    asOf: snap.capturedAt ?? new Date().toISOString(),
    snapshotFile: file,
  };
}

/**
 * Primary loader for Terminal / Convention / anomaly UIs.
 */
export async function loadTokenBundle(): Promise<TokenBundle> {
  if (snapshotOnly()) {
    const snap = await loadLatestSnapshot<SnapshotPayload>();
    if (!snap) {
      return {
        source: 'none',
        asOf: null,
        stale: true,
        error: 'SNAPSHOT_ONLY=true and no snapshot',
        rows: [],
      };
    }
    const parsed = fromSnapshot(snap.data, snap.file);
    if (!parsed) {
      return {
        source: 'none',
        asOf: null,
        stale: true,
        snapshotFile: snap.file,
        error: 'snapshot unusable',
        rows: [],
      };
    }
    return {
      source: 'snapshot',
      asOf: parsed.asOf,
      stale: true,
      snapshotFile: parsed.snapshotFile,
      rows: parsed.rows,
    };
  }

  const result = await tryLiveThenSnapshot<
    { rows: TokenRow[]; asOf: string; snapshotFile?: string },
    SnapshotPayload
  >({
    live: async () => {
      const live = await liveAssemble();
      return live;
    },
    fromSnapshot: (snap, file) => fromSnapshot(snap, file),
  });

  if (!result.data) {
    return {
      source: 'none',
      asOf: null,
      stale: true,
      error: result.error,
      snapshotFile: result.snapshotFile,
      rows: [],
    };
  }

  return {
    source: result.source,
    asOf: result.data.asOf,
    stale: result.source === 'snapshot',
    snapshotFile: result.snapshotFile ?? result.data.snapshotFile,
    error: result.error,
    rows: result.data.rows,
  };
}
