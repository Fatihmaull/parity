/**
 * Read Token-2022 ScaledUiAmountConfig for a mint via Solana RPC.
 * Node runtime only — never import from Edge.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  unpackMint,
  getScaledUiAmountConfig,
} from '@solana/spl-token';

export interface MintScaledConfig {
  mint: string;
  decimals: number;
  multiplier: number;
  newMultiplier: number;
  newMultiplierEffectiveTimestamp: number;
  /** Convenience: effective multiplier at fetch time */
  effectiveMultiplier: number;
  fetchedAtSec: number;
}

export function getRpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  );
}

export function createConnection(rpcUrl: string = getRpcUrl()): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Cache-friendly pure fetch: given a Connection + mint address, return
 * ScaledUiAmount fields. Throws if account missing / not Token-2022 mint.
 */
export async function fetchMintScaledConfig(
  connection: Connection,
  mintAddress: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<MintScaledConfig> {
  const mintPk = new PublicKey(mintAddress);
  const info = await connection.getAccountInfo(mintPk, 'confirmed');
  if (!info) {
    throw new Error(`Mint account not found: ${mintAddress}`);
  }

  const mint = unpackMint(mintPk, info, TOKEN_2022_PROGRAM_ID);
  const cfg = getScaledUiAmountConfig(mint);

  const multiplier = cfg?.multiplier ?? 1;
  const newMultiplier = cfg?.newMultiplier ?? multiplier;
  const newMultiplierEffectiveTimestamp = cfg
    ? Number(cfg.newMultiplierEffectiveTimestamp)
    : 0;

  const effective =
    nowSec >= newMultiplierEffectiveTimestamp ? newMultiplier : multiplier;

  return {
    mint: mintAddress,
    decimals: mint.decimals,
    multiplier,
    newMultiplier,
    newMultiplierEffectiveTimestamp,
    effectiveMultiplier: effective,
    fetchedAtSec: nowSec,
  };
}

export async function fetchAllMintScaledConfigs(
  mints: readonly string[],
  rpcUrl: string = getRpcUrl(),
): Promise<{
  ok: MintScaledConfig[];
  errors: { mint: string; error: string }[];
}> {
  const connection = createConnection(rpcUrl);
  const nowSec = Math.floor(Date.now() / 1000);
  const ok: MintScaledConfig[] = [];
  const errors: { mint: string; error: string }[] = [];

  // Sequential to be gentle on public RPC; HELIUS can handle parallel later.
  for (const mint of mints) {
    try {
      const cfg = await fetchMintScaledConfig(connection, mint, nowSec);
      ok.push(cfg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ mint, error: msg });
    }
  }

  return { ok, errors };
}
