/**
 * Live RPC portfolio lookup for PreStocks universe (Token-2022).
 * Address paste only — no wallet adapter.
 * Snapshot cannot fake arbitrary wallets; RPC is required.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { UNIVERSE, UNIVERSE_BY_MINT } from '@/config/universe';
import {
  createConnection,
  getRpcUrl,
  type MintScaledConfig,
} from '@/lib/rpc/mintConfig';
import { valueHolding, type ValuationBreakdown } from '@/lib/portfolio/value';
import type { JupiterPriceMap } from '@/lib/jupiter/price';

export interface PortfolioHolding {
  symbol: string;
  mint: string;
  amountRaw: string;
  decimals: number;
  uiAmount: number | null;
  effectiveMultiplier: number;
  usdPrice: number | null;
  usdPricePrescaled: number | null;
  valuation: ValuationBreakdown;
  tokenAccount: string;
}

export interface PortfolioResult {
  ok: true;
  address: string;
  rpcUrlHost: string;
  holdings: PortfolioHolding[];
  totalDisplayUsd: number;
  totalCrossedUsd: number;
  empty: boolean;
}

export interface PortfolioError {
  ok: false;
  error: string;
  code: 'invalid_address' | 'rpc_error' | 'unknown';
}

export function isValidSolanaAddress(input: string): boolean {
  try {
    const pk = new PublicKey(input.trim());
    return PublicKey.isOnCurve(pk.toBytes()) || pk.toBase58().length >= 32;
  } catch {
    return false;
  }
}

/** Accept any base58 pubkey (including PDA owners that are off-curve). */
export function parseOwnerAddress(input: string): PublicKey | null {
  try {
    return new PublicKey(input.trim());
  } catch {
    return null;
  }
}

function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'rpc';
  }
}

function pricePair(
  mint: string,
  prices: JupiterPriceMap,
  mintCfg: MintScaledConfig | undefined,
): {
  usdPrice: number | null;
  usdPricePrescaled: number | null;
  effectiveMultiplier: number;
} {
  const j = prices[mint];
  const m =
    mintCfg?.effectiveMultiplier ??
    (j?.scaledUiConfig?.newMultiplier != null ||
    j?.scaledUiConfig?.multiplier != null
      ? Number(
          j?.scaledUiConfig?.newMultiplier ??
            j?.scaledUiConfig?.multiplier ??
            1,
        )
      : 1);
  const usdPrice =
    typeof j?.usdPrice === 'number' && Number.isFinite(j.usdPrice)
      ? j.usdPrice
      : null;
  let usdPricePrescaled =
    typeof j?.scaledUiConfig?.usdPricePrescaled === 'number' &&
    Number.isFinite(j.scaledUiConfig.usdPricePrescaled)
      ? j.scaledUiConfig.usdPricePrescaled
      : null;
  if (usdPricePrescaled == null && usdPrice != null) {
    usdPricePrescaled = usdPrice * m;
  }
  return {
    usdPrice,
    usdPricePrescaled,
    effectiveMultiplier: mintCfg?.effectiveMultiplier ?? m,
  };
}

/**
 * Fetch Token-2022 accounts owned by `owner` and filter to PreStocks universe.
 */
export async function fetchUniverseHoldings(
  ownerAddress: string,
  prices: JupiterPriceMap,
  mintConfigs: ReadonlyMap<string, MintScaledConfig>,
  connection: Connection = createConnection(),
): Promise<PortfolioResult | PortfolioError> {
  const owner = parseOwnerAddress(ownerAddress);
  if (!owner) {
    return {
      ok: false,
      error: 'Invalid Solana address (expected base58 pubkey).',
      code: 'invalid_address',
    };
  }

  const universeMints = new Set(UNIVERSE.map((t) => t.mint));

  try {
    const resp = await connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_2022_PROGRAM_ID },
      'confirmed',
    );

    const holdings: PortfolioHolding[] = [];

    for (const { pubkey, account } of resp.value) {
      const parsed = account.data.parsed as {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmount?: number | null;
            uiAmountString?: string;
          };
        };
      };
      const mint = parsed.info?.mint;
      if (!mint || !universeMints.has(mint)) continue;

      const ta = parsed.info?.tokenAmount;
      const amountRaw = ta?.amount ?? '0';
      if (amountRaw === '0') continue;

      const decimals = ta?.decimals ?? 9;
      let uiAmount: number | null =
        typeof ta?.uiAmount === 'number' && Number.isFinite(ta.uiAmount)
          ? ta.uiAmount
          : null;
      if (uiAmount == null && ta?.uiAmountString) {
        const n = Number(ta.uiAmountString);
        if (Number.isFinite(n)) uiAmount = n;
      }

      const meta = UNIVERSE_BY_MINT.get(mint)!;
      const pair = pricePair(mint, prices, mintConfigs.get(mint));
      const valuation = valueHolding(
        {
          amountRaw,
          decimals,
          uiAmount,
          effectiveMultiplier: pair.effectiveMultiplier,
        },
        {
          usdPrice: pair.usdPrice,
          usdPricePrescaled: pair.usdPricePrescaled,
        },
      );

      holdings.push({
        symbol: meta.symbol,
        mint,
        amountRaw,
        decimals,
        uiAmount: valuation.uiAmount,
        effectiveMultiplier: pair.effectiveMultiplier,
        usdPrice: pair.usdPrice,
        usdPricePrescaled: pair.usdPricePrescaled,
        valuation,
        tokenAccount: pubkey.toBase58(),
      });
    }

    holdings.sort(
      (a, b) =>
        (b.valuation.valueDisplay ?? 0) - (a.valuation.valueDisplay ?? 0),
    );

    const totalDisplayUsd = holdings.reduce(
      (s, h) => s + (h.valuation.valueDisplay ?? 0),
      0,
    );
    // "What other tools would show" — prefer scaled×prescaled when m≠1, else raw×usdPrice
    const totalCrossedUsd = holdings.reduce((s, h) => {
      const v = h.valuation;
      const crossed =
        h.effectiveMultiplier !== 1
          ? (v.crossedScaledTimesPrescaled ?? v.crossedRawTimesUsdPrice ?? 0)
          : (v.valueDisplay ?? 0);
      return s + crossed;
    }, 0);

    return {
      ok: true,
      address: owner.toBase58(),
      rpcUrlHost: rpcHost(getRpcUrl()),
      holdings,
      totalDisplayUsd,
      totalCrossedUsd,
      empty: holdings.length === 0,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `RPC failed (${rpcHost(getRpcUrl())}): ${msg}`,
      code: 'rpc_error',
    };
  }
}
