/**
 * Load PreStocks universe, fetch ScaledUiAmount configs, print console table.
 * Usage: npm run print-multipliers
 */

import { UNIVERSE } from '../src/config/universe';
import {
  fetchAllMintScaledConfigs,
  getRpcUrl,
} from '../src/lib/rpc/mintConfig';

async function main() {
  const rpc = getRpcUrl();
  console.log(`RPC: ${rpc.replace(/api-key=[^&]+/i, 'api-key=***')}`);
  console.log(`Universe: ${UNIVERSE.length} PreStocks mints (no Tessera)\n`);

  const mints = UNIVERSE.map((t) => t.mint);
  const { ok, errors } = await fetchAllMintScaledConfigs(mints);

  const byMint = new Map(ok.map((c) => [c.mint, c]));

  const rows = UNIVERSE.map((t) => {
    const c = byMint.get(t.mint);
    if (!c) {
      return {
        symbol: t.symbol,
        decimals: '—',
        multiplier: '—',
        newMultiplier: '—',
        effectiveAt: '—',
        effectiveMultiplier: 'FAIL',
      };
    }
    return {
      symbol: t.symbol,
      decimals: c.decimals,
      multiplier: c.multiplier,
      newMultiplier: c.newMultiplier,
      effectiveAt: c.newMultiplierEffectiveTimestamp,
      effectiveMultiplier: c.effectiveMultiplier,
    };
  });

  console.table(rows);

  for (const err of errors) {
    const sym =
      UNIVERSE.find((t) => t.mint === err.mint)?.symbol ?? err.mint.slice(0, 8);
    console.error(`\n!!! MINT FAIL [${sym}] ${err.mint}\n    ${err.error}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length}/${UNIVERSE.length} mints failed to resolve.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${ok.length} mint configs resolved.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
