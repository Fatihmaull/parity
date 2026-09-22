/**
 * Untokenized names with PreStocks marks but no token yet (Shadow board).
 * Skip symbols whose batch mark is null (e.g. CEREBRAS).
 */
export const SHADOW_CANDIDATES = [
  'STRIPE',
  'DATABRICKS',
  'PERPLEXITY',
  'DISCORD',
  'EPICGAMES',
  'KRAKEN',
  'RAMP',
  'REVOLUT',
  'BYTEDANCE',
  'CANVA',
  'RIPPLE',
  'WAYMO',
  // CEREBRAS intentionally omitted — mark-price batch returns null
] as const;

export type ShadowSymbol = (typeof SHADOW_CANDIDATES)[number];
