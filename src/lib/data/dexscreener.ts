/**
 * Optional DexScreener liquidity / 24h volume / priceUsd hints.
 * Failures are soft — UI falls back to Jupiter liquidity + PreStocks stats.
 * priceUsd is labeled in UI as likely raw / unscaled.
 */

import { UNIVERSE_MINTS } from '@/config/universe';
import type { DexPairHint } from '@/lib/domain';

const DEX_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

interface DexPair {
  priceUsd?: string | number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  chainId?: string;
}

interface DexResponse {
  pairs?: DexPair[] | null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function hintFromPairs(mint: string, pairs: DexPair[]): DexPairHint {
  let liq = 0;
  let vol = 0;
  let hasLiq = false;
  let hasVol = false;
  let bestPrice: number | null = null;
  let bestLiqForPrice = -1;
  for (const p of pairs) {
    if (p.chainId && p.chainId !== 'solana') continue;
    const l = p.liquidity?.usd;
    const v = p.volume?.h24;
    if (typeof l === 'number' && Number.isFinite(l)) {
      liq += l;
      hasLiq = true;
      const px = num(p.priceUsd);
      if (px != null && l >= bestLiqForPrice) {
        bestLiqForPrice = l;
        bestPrice = px;
      }
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      vol += v;
      hasVol = true;
    }
  }
  return {
    mint,
    liquidityUsd: hasLiq ? liq : null,
    volume24hUsd: hasVol ? vol : null,
    priceUsd: bestPrice,
  };
}

export async function fetchDexScreenerForMints(
  mints: readonly string[] = UNIVERSE_MINTS,
): Promise<Map<string, DexPairHint>> {
  const out = new Map<string, DexPairHint>();
  const chunkSize = 5;
  for (let i = 0; i < mints.length; i += chunkSize) {
    const chunk = mints.slice(i, i + chunkSize);
    const url = `${DEX_BASE}/${chunk.join(',')}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PARITY/0.1 (PreStocks analytics)',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue; // incl. 429
      const body = (await res.json()) as DexResponse;
      const pairs = body.pairs ?? [];
      if (chunk.length === 1) {
        out.set(chunk[0]!, hintFromPairs(chunk[0]!, pairs));
      }
    } catch {
      // soft fail
    }
  }
  return out;
}

/** One-mint-at-a-time fetch (more reliable mapping). Graceful on 429. */
export async function fetchDexScreenerHints(
  mints: readonly string[] = UNIVERSE_MINTS,
): Promise<Map<string, DexPairHint>> {
  const out = new Map<string, DexPairHint>();
  await Promise.all(
    mints.map(async (mint) => {
      try {
        const res = await fetch(`${DEX_BASE}/${mint}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'PARITY/0.1 (PreStocks analytics)',
          },
          cache: 'no-store',
        });
        if (!res.ok) return; // soft — incl. 429
        const body = (await res.json()) as DexResponse;
        out.set(mint, hintFromPairs(mint, body.pairs ?? []));
      } catch {
        // soft
      }
    }),
  );
  return out;
}
