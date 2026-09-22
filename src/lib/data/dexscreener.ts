/**
 * Optional DexScreener liquidity / 24h volume hints.
 * Failures are soft — UI falls back to Jupiter liquidity + PreStocks stats.
 */

import { UNIVERSE_MINTS } from '@/config/universe';
import type { DexPairHint } from '@/lib/domain';

const DEX_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

interface DexPair {
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  chainId?: string;
}

interface DexResponse {
  pairs?: DexPair[] | null;
}

export async function fetchDexScreenerForMints(
  mints: readonly string[] = UNIVERSE_MINTS,
): Promise<Map<string, DexPairHint>> {
  const out = new Map<string, DexPairHint>();
  // Batch in chunks of 5 to avoid URL length / rate limits
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
      if (!res.ok) continue;
      const body = (await res.json()) as DexResponse;
      const pairs = body.pairs ?? [];
      // Group by mint appearing in pair — Dex returns baseToken.address
      // We don't have mint on each pair cleanly when batching; match by querying
      // individually is safer. For batch response, sum solana pairs per call.
      // When single mint in URL, all pairs belong to that mint.
      if (chunk.length === 1) {
        const mint = chunk[0]!;
        let liq = 0;
        let vol = 0;
        let hasLiq = false;
        let hasVol = false;
        for (const p of pairs) {
          if (p.chainId && p.chainId !== 'solana') continue;
          const l = p.liquidity?.usd;
          const v = p.volume?.h24;
          if (typeof l === 'number' && Number.isFinite(l)) {
            liq += l;
            hasLiq = true;
          }
          if (typeof v === 'number' && Number.isFinite(v)) {
            vol += v;
            hasVol = true;
          }
        }
        out.set(mint, {
          mint,
          liquidityUsd: hasLiq ? liq : null,
          volume24hUsd: hasVol ? vol : null,
        });
      }
    } catch {
      // soft fail
    }
  }
  return out;
}

/** One-mint-at-a-time fetch (more reliable mapping). */
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
        if (!res.ok) return;
        const body = (await res.json()) as DexResponse;
        let liq = 0;
        let vol = 0;
        let hasLiq = false;
        let hasVol = false;
        for (const p of body.pairs ?? []) {
          if (p.chainId && p.chainId !== 'solana') continue;
          const l = p.liquidity?.usd;
          const v = p.volume?.h24;
          if (typeof l === 'number' && Number.isFinite(l)) {
            liq += l;
            hasLiq = true;
          }
          if (typeof v === 'number' && Number.isFinite(v)) {
            vol += v;
            hasVol = true;
          }
        }
        out.set(mint, {
          mint,
          liquidityUsd: hasLiq ? liq : null,
          volume24hUsd: hasVol ? vol : null,
        });
      } catch {
        // soft
      }
    }),
  );
  return out;
}
