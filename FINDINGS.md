# PARITY FINDINGS

PreStocks-only correctness notes for STOCKLANA hackathon.
Tessera anomalies (e.g. tKalshi) are **out of scope**.

## 2026-09-22T13:42:12.718Z (22 Sept 2026, 20:42:12 WIB)

- Scope: **PreStocks-only** (Tessera / tKalshi anomaly OUT OF SCOPE)
- Jupiter: ok
- RPC: `https://api.mainnet-beta.solana.com` — resolved 9/9 mint configs.
- Convention assert (`usdPrice * m ≈ usdPricePrescaled`, tol 1e-4): **2 passed**, **0 failed**, **7 skipped/missing**
- **SPACEX effectiveMultiplier = 5** (document split/scale hook). On-chain: `multiplier=1`, `newMultiplier=5`, `newMultiplierEffectiveTimestamp=1781065800` (2026-06-10T04:30:00.000Z); `>=` rule → m=5. Jupiter: `usdPrice * 5 == usdPricePrescaled` (relErr 0).
- **OPENAI** pending scale already effective: `newMultiplier≈1.4861347` since 2026-07-17; convention holds (relErr 0).
- Note: Jupiter Price v3 appears to omit `scaledUiConfig` / `usdPricePrescaled` when effective m=1; assert skipped for those (not a failure).

| Symbol | usdPrice | usdPricePrescaled | m | relErr | passed | note |
|--------|----------|-------------------|---|--------|--------|------|
| ANTHROPIC | 1019.2213580208047 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| OPENAI | 1163.8727567980145 | 1729.6716902621904 | 1.4861347 | 0 | true |  |
| SPACEX | 116.33013473367114 | 581.6506736683557 | 5 | 0 | true |  |
| ANDURIL | 150.64619907148708 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| KALSHI | 869.5691405720887 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| NEURALINK | 442.33333160909837 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| POLYMARKET | 142.70052130635224 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| FIGUREAI | 182.59832499721912 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |
| XAI | 82.95088358032336 | — | 1 | — | skip | usdPricePrescaled absent — skip assert |

