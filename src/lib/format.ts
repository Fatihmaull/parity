/** Terminal numeric formatting — always pair with tabular-nums / mono. */

export function fmtUsd(
  n: number | null | undefined,
  digits = 2,
): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 10_000) {
    return `$${(n / 1_000).toFixed(1)}k`;
  }
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtMult(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return `${n}×`;
  return `${n.toFixed(4).replace(/\.?0+$/, '')}×`;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

export function fmtUsdPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) {
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (n >= 1) {
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `$${n.toPrecision(4)}`;
}
