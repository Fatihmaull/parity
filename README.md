# PARITY

**SPACEX effectiveMultiplier = 5** (document split/scale). On-chain `multiplier=1`, `newMultiplier=5`, effective since `2026-06-10`; Jupiter `usdPrice × 5 == usdPricePrescaled` (relErr 0). See [FINDINGS.md](./FINDINGS.md).

Read-only PreStocks analytics for Solana STOCKLANA — ScaledUiAmount-aware premiums, convention check, history, portfolio lookup.

- **Terminal** — all PreStocks sorted by `|premium|`; display⇄raw toggle never changes premium %
- **History** — cumulative + daily (differenced) volume and weekly holders from PreStocks `/api/stats`
- **Portfolio** — paste any Solana address; value Token-2022 holdings correctly (uiAmount × usdPrice) and show the crossed-convention bug

**Bounty scope: PreStocks-only.** Tessera tokens (`tOpenAI`, `tKalshi`, `tSpaceX`, …) are **excluded for eligibility**. No wallet adapter / swap / auth / Anchor.

## Setup

```bash
cp .env.example .env.local   # optional HELIUS_RPC_URL
npm i
npm run snapshot             # PreStocks + Jupiter + mint configs → src/data/snapshot/
npm run dev
```

Optional checks: `npm test`, `npm run print-multipliers`, `npm run assert-prices`.

`SNAPSHOT_ONLY=true` serves Terminal / History / Convention / IPO from snapshot (no live fetches). Portfolio always needs live RPC.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Terminal — screener presets, watchlist, quality, IPO months, expand for convention/venue |
| `/splits` | ScaledUiAmount multiplier timeline (SPACEX ×5, OPENAI ≈1.486) |
| `/shadow` | Untokenized names with PreStocks marks (`/api/mark-price/batch`) |
| `/history` | Cumulative / daily volume + weekly holders (`/api/stats`) |
| `/portfolio` | Address paste → PreStocks holdings + crossed comparison |
| `/convention` | 2×2 Convention Check (default SPACEX) |
| `/ipo` | Polymarket IPO probability ladders |
| `/disclosures` | Legal framing / May 2026 SPV statements |

## Architecture

- Next.js App Router (`src/`), TypeScript strict, Tailwind, **Node runtime only**
- Data: PreStocks catalogue / metrics / stats → normalize → `TokenRow[]`
- Prices: Jupiter Price v3 (`usdPrice`, `usdPricePrescaled`)
- Multipliers: on-chain Token-2022 `getScaledUiAmountConfig` (`>=` timestamp rule)
- Charts: recharts 3.x · Portfolio: `getParsedTokenAccountsByOwner` (Token-2022)
- Offline path: `tryLiveThenSnapshot` + `npm run snapshot`

## Correctness (brief)

- RPC `uiAmount` **already includes** the multiplier — never double-apply
- `nowSec >= newMultiplierEffectiveTimestamp` → use `newMultiplier`
- Jupiter: `usdPrice` ↔ scaled amounts; `usdPricePrescaled` ↔ raw / 10^decimals
- Premium % always from display price vs mark (convention-invariant)
- Never mix `/api/stats` holders with `/api/metrics` holderCount in one chart

## Honest limitations

- DexScreener may 429 — volume falls back to PreStocks stats deltas
- Public Solana RPC is rate-limited; set `HELIUS_RPC_URL` for portfolio reliability
- No Tessera coverage (bounty eligibility)
- Portfolio cannot use snapshot for arbitrary wallets — live RPC required

## Stack pins

See `package.json` — Next 16 / React 19 / recharts 3 / `@solana/web3.js` 1.99 / vitest.
