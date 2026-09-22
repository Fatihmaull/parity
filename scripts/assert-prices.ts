/**
 * Fetch Jupiter prices, assert usdPrice * m ≈ usdPricePrescaled, update FINDINGS.md.
 * Usage: npm run assert-prices
 */

import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { UNIVERSE } from '../src/config/universe';
import {
  fetchJupiterPrices,
  assertPriceConventions,
} from '../src/lib/jupiter/price';
import {
  fetchAllMintScaledConfigs,
  getRpcUrl,
} from '../src/lib/rpc/mintConfig';
import type { MintScaledConfig } from '../src/lib/rpc/mintConfig';

async function main() {
  const now = new Date();
  const stamp = now.toISOString();
  const localLabel = now.toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  console.log(`Asserting Jupiter price conventions @ ${stamp} (${localLabel} WIB)\n`);

  // Best-effort RPC for multipliers when Jupiter omits scaledUiConfig
  let mintMap = new Map<string, MintScaledConfig>();
  let rpcNote = '';
  try {
    const { ok, errors } = await fetchAllMintScaledConfigs(
      UNIVERSE.map((t) => t.mint),
    );
    mintMap = new Map(ok.map((c) => [c.mint, c]));
    if (errors.length) {
      rpcNote = `RPC partial failures (${errors.length}): ${errors
        .map((e) => e.mint.slice(0, 8))
        .join(', ')}`;
      console.warn(rpcNote);
    }
  } catch (e) {
    rpcNote = `RPC unavailable: ${e instanceof Error ? e.message : String(e)}`;
    console.warn(rpcNote);
  }

  const jup = await fetchJupiterPrices();
  if (!jup.ok) {
    console.error(`Jupiter fetch failed: ${jup.error ?? jup.status}`);
  } else {
    console.log(`Jupiter: ${Object.keys(jup.prices).length} price entries`);
  }

  const checks = assertPriceConventions(
    jup.prices,
    mintMap,
    Math.floor(Date.now() / 1000),
  );

  console.table(
    checks.map((c) => ({
      symbol: c.symbol,
      usdPrice: c.usdPrice,
      usdPricePrescaled: c.usdPricePrescaled,
      m: c.multiplierUsed,
      relErr: c.relativeError,
      passed: c.passed,
      note: c.note ?? '',
    })),
  );

  // SPACEX hook
  const spacexCfg = mintMap.get(
    UNIVERSE.find((t) => t.symbol === 'SPACEX')!.mint,
  );
  const spacexM = spacexCfg?.effectiveMultiplier;
  const spacexNote =
    spacexM === 5
      ? 'SPACEX effectiveMultiplier = 5 (document split/scale hook).'
      : spacexM != null
        ? `SPACEX effectiveMultiplier = ${spacexM} (not 5 at this time).`
        : 'SPACEX multiplier unresolved (RPC).';

  const passed = checks.filter((c) => c.passed === true);
  const failed = checks.filter((c) => c.passed === false);
  const skipped = checks.filter((c) => c.passed === null);

  const section = `
## ${stamp} (${localLabel} WIB)

- Scope: **PreStocks-only** (Tessera / tKalshi anomaly OUT OF SCOPE)
- Jupiter: ${jup.ok ? 'ok' : `FAIL ${jup.status}`} ${jup.rateLimited ? '(429 rate limited)' : ''} ${jup.error ?? ''}
- RPC: \`${getRpcUrl().replace(/api-key=[^&]+/i, 'api-key=***')}\` — resolved ${mintMap.size}/${UNIVERSE.length} mint configs. ${rpcNote}
- Convention assert (\`usdPrice * m ≈ usdPricePrescaled\`, tol 1e-4): **${passed.length} passed**, **${failed.length} failed**, **${skipped.length} skipped/missing**
- ${spacexNote}

| Symbol | usdPrice | usdPricePrescaled | m | relErr | passed | note |
|--------|----------|-------------------|---|--------|--------|------|
${checks
  .map(
    (c) =>
      `| ${c.symbol} | ${c.usdPrice ?? '—'} | ${c.usdPricePrescaled ?? '—'} | ${c.multiplierUsed ?? '—'} | ${c.relativeError ?? '—'} | ${c.passed === null ? 'skip' : c.passed} | ${(c.note ?? '').replace(/\|/g, '/')} |`,
  )
  .join('\n')}
`;

  const findingsPath = path.join(process.cwd(), 'FINDINGS.md');
  let existing = '';
  try {
    existing = await readFile(findingsPath, 'utf8');
  } catch {
    existing = `# PARITY FINDINGS\n\nPreStocks-only correctness notes for STOCKLANA hackathon.\n`;
  }

  // Prepend newest section after title block
  const updated = existing.includes('# PARITY FINDINGS')
    ? existing.replace(
        /(# PARITY FINDINGS[\s\S]*?\n)/,
        `$1\n${section}\n`,
      )
    : `# PARITY FINDINGS\n\n${section}\n${existing}`;

  await writeFile(findingsPath, updated, 'utf8');
  console.log(`\nUpdated ${findingsPath}`);
  console.log(spacexNote);

  if (jup.rateLimited || failed.length > 0) {
    process.exitCode = jup.rateLimited ? 0 : 1; // 429 is environmental, not code fail
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
