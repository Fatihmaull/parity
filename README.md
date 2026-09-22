# PARITY

Read-only PreStocks analytics for Solana STOCKLANA — Day 1 correctness core (ScaledUiAmount multipliers + Jupiter price conventions).

**Bounty scope: PreStocks-only.** No Tessera tokens (`tOpenAI`, `tKalshi`, `tSpaceX`, …). No wallet / swap / auth / Anchor.

**SPACEX hook:** if on-chain `effectiveMultiplier === 5`, document the split/scale in `FINDINGS.md` (see `npm run assert-prices`).

## Stack

- Next.js App Router (`src/`), TypeScript strict, Tailwind, Node runtime only
- `@solana/web3.js` + `@solana/spl-token` for Token-2022 ScaledUiAmount
- Vitest for conversion math

## Setup

```bash
cp .env.example .env.local   # optional HELIUS_RPC_URL
npm install
npm test
npm run print-multipliers
npm run assert-prices
npm run snapshot
npm run dev
```

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` / `build` | Next.js |
| `test` | Vitest unit tests (`src/lib/scaled.test.ts`) |
| `print-multipliers` | RPC table: symbol, decimals, multipliers |
| `assert-prices` | Jupiter v3 convention assert → `FINDINGS.md` |
| `snapshot` | PreStocks + Jupiter + mint configs → `src/data/snapshot/` |

## Correctness rules

- RPC `uiAmount` **already includes** the multiplier — never double-apply.
- `nowSec >= newMultiplierEffectiveTimestamp` → use `newMultiplier`.
- Jupiter: `usdPrice` pairs with scaled amounts; `usdPricePrescaled` with raw/`10^decimals`.

## Pinned / installed versions

```
{
  "next": "16.3.5",
  "react": "19.2.8",
  "typescript": "5.9.3",
  "tailwindcss": "4.3.3",
  "@solana/web3.js": "1.99.0",
  "@solana/spl-token": "0.4.15",
  "vitest": "3.2.4",
  "zod": "4.6.5"
}
```
