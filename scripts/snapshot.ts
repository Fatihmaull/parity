/**
 * Snapshot PreStocks APIs + Jupiter prices + mint configs → src/data/snapshot/
 * Usage: npm run snapshot
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UNIVERSE } from '../src/config/universe';
import {
  fetchPrestocksCatalogue,
  fetchPrestocksMetrics,
  fetchPrestocksStats,
} from '../src/lib/data/prestocks';
import { fetchJupiterPrices } from '../src/lib/jupiter/price';
import {
  fetchAllMintScaledConfigs,
  getRpcUrl,
} from '../src/lib/rpc/mintConfig';

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`[snapshot] ${label} failed: ${error}`);
    return { ok: false, error };
  }
}

async function main() {
  const now = new Date();
  const iso = now.toISOString();
  const fileStamp = iso.replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'src/data/snapshot');
  await mkdir(outDir, { recursive: true });

  console.log(`Snapshot starting ${iso}`);

  const [catalogue, metrics, stats, jupiter, mintConfigs] = await Promise.all([
    safe('prestocks/catalogue', fetchPrestocksCatalogue),
    safe('prestocks/metrics', fetchPrestocksMetrics),
    safe('prestocks/stats', fetchPrestocksStats),
    safe('jupiter/price/v3', async () => {
      const r = await fetchJupiterPrices();
      if (!r.ok) throw new Error(r.error ?? `HTTP ${r.status}`);
      return r;
    }),
    safe('rpc/mintConfigs', async () => {
      const r = await fetchAllMintScaledConfigs(UNIVERSE.map((t) => t.mint));
      return { rpcUrl: getRpcUrl().replace(/api-key=[^&]+/i, 'api-key=***'), ...r };
    }),
  ]);

  const payload = {
    capturedAt: iso,
    scope: 'prestocks-only',
    universe: UNIVERSE,
    prestocks: {
      catalogue: catalogue.ok ? catalogue.data : null,
      catalogueError: catalogue.ok ? null : catalogue.error,
      metrics: metrics.ok ? metrics.data : null,
      metricsError: metrics.ok ? null : metrics.error,
      stats: stats.ok ? stats.data : null,
      statsError: stats.ok ? null : stats.error,
    },
    jupiter: jupiter.ok ? jupiter.data : null,
    jupiterError: jupiter.ok ? null : jupiter.error,
    mintConfigs: mintConfigs.ok ? mintConfigs.data : null,
    mintConfigsError: mintConfigs.ok ? null : mintConfigs.error,
  };

  const outPath = path.join(outDir, `snapshot-${fileStamp}.json`);
  await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
  // Also write/overwrite latest pointer
  const latestPath = path.join(outDir, 'latest.json');
  await writeFile(latestPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${latestPath}`);
  console.log(
    JSON.stringify(
      {
        catalogue: catalogue.ok,
        metrics: metrics.ok,
        stats: stats.ok,
        jupiter: jupiter.ok,
        mintConfigs: mintConfigs.ok,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
