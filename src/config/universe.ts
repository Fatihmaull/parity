/**
 * PreStocks-only token universe for PARITY (STOCKLANA hackathon).
 * Verified from PreStocks API 22 Sep 2026.
 * NO Tessera tokens (tOpenAI, tKalshi, tSpaceX, etc.).
 */

export type Issuer = 'prestocks';
export type LegalStructure = 'spv-exposure';

export interface UniverseToken {
  symbol: string;
  mint: string;
  issuer: Issuer;
  legalStructure: LegalStructure;
  /** Present in /api/metrics even if catalogue listing is sparse */
  notes?: string;
}

export const UNIVERSE: readonly UniverseToken[] = [
  {
    symbol: 'ANTHROPIC',
    mint: 'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'OPENAI',
    mint: 'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'SPACEX',
    mint: 'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'ANDURIL',
    mint: 'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'KALSHI',
    mint: 'PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'NEURALINK',
    mint: 'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'POLYMARKET',
    mint: 'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'FIGUREAI',
    mint: 'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
  },
  {
    symbol: 'XAI',
    mint: 'PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx',
    issuer: 'prestocks',
    legalStructure: 'spv-exposure',
    notes: 'May only appear in /api/metrics; still included as prestocks',
  },
] as const;

export const UNIVERSE_BY_MINT: ReadonlyMap<string, UniverseToken> = new Map(
  UNIVERSE.map((t) => [t.mint, t]),
);

export const UNIVERSE_BY_SYMBOL: ReadonlyMap<string, UniverseToken> = new Map(
  UNIVERSE.map((t) => [t.symbol, t]),
);

export const UNIVERSE_MINTS: readonly string[] = UNIVERSE.map((t) => t.mint);

export const PRESTOCKS_API_BASE = 'https://prestocks.com';
