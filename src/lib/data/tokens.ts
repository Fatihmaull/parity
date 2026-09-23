/**
 * Assemble TokenRow[] from PreStocks + Jupiter + RPC (+ optional DexScreener).
 * Prefer live; SNAPSHOT_ONLY / total failure → src/data/snapshot/latest.json.
 *
 * Partial PreStocks failures (e.g. metrics 429) fill THAT piece from snapshot
 * and set partialStale + warnings — not full stale snapshot mode.
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
  /** True only for full snapshot fallback or SNAPSHOT_ONLY. */
  stale: boolean;
  /** Live primary data, but one+ secondary sources came from snapshot. */
  partialStale?: boolean;
  warnings?: string[];
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

type LiveAssembleResult = {
  rows: TokenRow[];
  asOf: string;
  partialStale: boolean;
  warnings: string[];
};

/**
 * Fetch sources independently. Soft-failed PreStocks pieces are filled from
 * the latest snapshot for that piece only. Prefer live Jupiter + RPC.
 */
async function liveAssemble(): Promise<LiveAssembleResult | null> {
  const warnings: string[] = [];
  let snapCached: { file: string; data: SnapshotPayload } | null | undefined;

  async function snap(): Promise<{ file: string; data: SnapshotPayload } | null> {
    if (snapCached !== undefined) return snapCached;
    snapCached = await loadLatestSnapshot<SnapshotPayload>();
    return snapCached;
  }

  const [catRes, metRes, statsRes, jupiter, mintRes] = await Promise.all([
    fetchPrestocksCatalogue(),
    fetchPrestocksMetrics(),
    fetchPrestocksStats(),
    fetchJupiterPrices(),
    fetchAllMintScaledConfigs(UNIVERSE_MINTS),
  ]);

  let catalogue = catRes.ok ? asCatalogue(catRes.data) : null;
  let metrics = metRes.ok ? asMetrics(metRes.data) : null;
  let stats = statsRes.ok ? asStats(statsRes.data) : null;
  let usedSnapshotPiece = false;

  if (!catRes.ok) {
    const s = await snap();
    const fromSnap = asCatalogue(s?.data.prestocks?.catalogue);
    if (fromSnap) {
      catalogue = fromSnap;
      usedSnapshotPiece = true;
      warnings.push(`Catalogue from snapshot — ${catRes.error}`);
    } else {
      warnings.push(catRes.error);
    }
  }

  if (!metRes.ok) {
    const s = await snap();
    const fromSnap = asMetrics(s?.data.prestocks?.metrics);
    if (fromSnap) {
      metrics = fromSnap;
      usedSnapshotPiece = true;
      warnings.push(`Metrics from snapshot — ${metRes.error}`);
    } else {
      warnings.push(metRes.error);
    }
  }

  if (!statsRes.ok) {
    const s = await snap();
    const fromSnap = asStats(s?.data.prestocks?.stats);
    if (fromSnap) {
      stats = fromSnap;
      usedSnapshotPiece = true;
      warnings.push(`Stats from snapshot — ${statsRes.error}`);
    } else {
      warnings.push(statsRes.error);
    }
  }

  let jupiterPrices = jupiter.prices ?? {};
  if (!jupiter.ok && Object.keys(jupiterPrices).length === 0) {
    const s = await snap();
    const snapPrices = s?.data.jupiter?.prices;
    if (snapPrices && Object.keys(snapPrices).length > 0) {
      jupiterPrices = snapPrices;
      usedSnapshotPiece = true;
      warnings.push(
        `Jupiter from snapshot — ${jupiter.error ?? `HTTP ${jupiter.status}`}`,
      );
    } else if (jupiter.error) {
      warnings.push(jupiter.error);
    }
  } else if (jupiter.rateLimited) {
    warnings.push(jupiter.error ?? 'Jupiter rate limit exceeded (429)');
  }

  const mintConfigs = new Map<string, MintScaledConfig>();
  for (const c of mintRes.ok) mintConfigs.set(c.mint, c);
  if (mintConfigs.size === 0) {
    const s = await snap();
    const fromSnap = mintMapFromSnapshot(s?.data ?? {});
    if (fromSnap.size > 0) {
      for (const [k, v] of fromSnap) mintConfigs.set(k, v);
      usedSnapshotPiece = true;
      warnings.push('Mint configs from snapshot — live RPC empty/failed');
    }
  }

  let dexByMint: Map<string, DexPairHint> | undefined;
  try {
    dexByMint = await fetchDexScreenerHints(UNIVERSE_MINTS);
    if (dexByMint.size === 0) {
      const s = await snap();
      const fromSnap = dexMapFromSnapshot(s?.data ?? {});
      if (fromSnap && fromSnap.size > 0) {
        dexByMint = fromSnap;
        usedSnapshotPiece = true;
        warnings.push('DexScreener from snapshot — live empty/429');
      } else {
        dexByMint = undefined;
      }
    }
  } catch {
    const s = await snap();
    const fromSnap = dexMapFromSnapshot(s?.data ?? {});
    if (fromSnap && fromSnap.size > 0) {
      dexByMint = fromSnap;
      usedSnapshotPiece = true;
      warnings.push('DexScreener from snapshot — live fetch failed');
    } else {
      dexByMint = undefined;
    }
  }

  const hasCatalogue = catalogue != null && catalogue.length > 0;
  const hasJupiter = Object.keys(jupiterPrices).length > 0;
  // Usable if we have catalogue and/or jupiter prices (UNIVERSE still yields rows).
  if (!hasCatalogue && !hasJupiter) {
    return null;
  }

  const rows = normalizeTokenRows({
    prestocks: {
      catalogue,
      metrics,
      stats,
    },
    jupiterPrices,
    mintConfigs,
    dexByMint,
  });

  if (rows.length === 0) return null;

  return {
    rows,
    asOf: new Date().toISOString(),
    partialStale: usedSnapshotPiece,
    warnings,
  };
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
    LiveAssembleResult & { snapshotFile?: string },
    SnapshotPayload
  >({
    live: async () => {
      const live = await liveAssemble();
      return live;
    },
    fromSnapshot: (snap, file) => {
      const parsed = fromSnapshot(snap, file);
      if (!parsed) return null;
      return {
        rows: parsed.rows,
        asOf: parsed.asOf,
        snapshotFile: parsed.snapshotFile,
        partialStale: false,
        warnings: [],
      };
    },
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

  const isFullSnapshot = result.source === 'snapshot';
  const warnings = result.data.warnings ?? [];
  const errorParts: string[] = [];
  if (result.error) errorParts.push(result.error);
  if (warnings.length) errorParts.push(...warnings);

  return {
    source: result.source,
    asOf: result.data.asOf,
    stale: isFullSnapshot,
    partialStale: !isFullSnapshot && Boolean(result.data.partialStale),
    warnings: warnings.length ? warnings : undefined,
    snapshotFile: result.snapshotFile ?? result.data.snapshotFile,
    error: errorParts.length ? errorParts.join('; ') : undefined,
    rows: result.data.rows,
  };
}
