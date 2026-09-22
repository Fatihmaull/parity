import { NextResponse } from 'next/server';
import { fetchJupiterPrices } from '@/lib/jupiter/price';
import {
  fetchAllMintScaledConfigs,
  type MintScaledConfig,
} from '@/lib/rpc/mintConfig';
import { fetchUniverseHoldings, parseOwnerAddress } from '@/lib/rpc/portfolio';
import { UNIVERSE_MINTS } from '@/config/universe';
import {
  loadLatestSnapshot,
  snapshotOnly,
} from '@/lib/data/liveOrSnapshot';
import type { SnapshotPayload } from '@/lib/data/tokens';
import type { JupiterPriceMap } from '@/lib/jupiter/price';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function loadPricesAndMints(): Promise<{
  prices: JupiterPriceMap;
  mintConfigs: Map<string, MintScaledConfig>;
  priceSource: 'live' | 'snapshot';
}> {
  const mintConfigs = new Map<string, MintScaledConfig>();

  if (!snapshotOnly()) {
    try {
      const [jup, mints] = await Promise.all([
        fetchJupiterPrices(),
        fetchAllMintScaledConfigs(UNIVERSE_MINTS),
      ]);
      for (const c of mints.ok) mintConfigs.set(c.mint, c);
      if (Object.keys(jup.prices).length > 0) {
        return { prices: jup.prices, mintConfigs, priceSource: 'live' };
      }
    } catch {
      // fall through to snapshot prices
    }
  }

  const snap = await loadLatestSnapshot<SnapshotPayload>();
  const prices = snap?.data.jupiter?.prices ?? {};
  for (const c of snap?.data.mintConfigs?.ok ?? []) {
    mintConfigs.set(c.mint, c);
  }
  // If live mint configs empty, still ok — multipliers from jupiter/snapshot
  if (!snapshotOnly() && mintConfigs.size === 0) {
    try {
      const mints = await fetchAllMintScaledConfigs(UNIVERSE_MINTS);
      for (const c of mints.ok) mintConfigs.set(c.mint, c);
    } catch {
      /* ignore */
    }
  }
  return { prices, mintConfigs, priceSource: 'snapshot' };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get('address') ?? '').trim();

  if (!address) {
    return NextResponse.json(
      { ok: false, error: 'Missing address query param.', code: 'invalid_address' },
      { status: 400 },
    );
  }

  if (!parseOwnerAddress(address)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid Solana address (expected base58 pubkey).',
        code: 'invalid_address',
      },
      { status: 400 },
    );
  }

  try {
    const { prices, mintConfigs, priceSource } = await loadPricesAndMints();
    const result = await fetchUniverseHoldings(address, prices, mintConfigs);
    if (!result.ok) {
      const status = result.code === 'invalid_address' ? 400 : 502;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json({ ...result, priceSource });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, code: 'unknown' },
      { status: 500 },
    );
  }
}
