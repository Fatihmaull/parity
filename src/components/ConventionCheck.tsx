'use client';

import { useMemo, useState } from 'react';
import type { TokenRow } from '@/lib/domain';
import { fmtMult, fmtUsdPrice } from '@/lib/format';

const POSITION = 1000;

export function ConventionCheck({ rows }: { rows: TokenRow[] }) {
  const defaultSymbol =
    rows.find((r) => r.symbol === 'SPACEX')?.symbol ??
    rows[0]?.symbol ??
    'SPACEX';
  const [symbol, setSymbol] = useState(defaultSymbol);
  const row = useMemo(
    () => rows.find((r) => r.symbol === symbol) ?? rows[0],
    [rows, symbol],
  );

  if (!row) {
    return (
      <p className="text-sm text-[var(--muted)]">No token data available.</p>
    );
  }

  const m = row.effectiveMultiplier;
  const usdPrice = row.jupiterUsdPrice ?? row.priceDisplay;
  const usdPrescaled =
    row.jupiterUsdPricePrescaled ??
    (usdPrice != null ? usdPrice * m : null);

  // Fixed position of 1,000 tokens
  const uiAmount = POSITION; // scaled / display amount
  const rawAmount = POSITION / m; // amount/10^decimals equivalent in token units

  const cells = [
    {
      label: 'scaled amount (uiAmount)',
      amountLabel: `${uiAmount.toLocaleString()} uiAmount`,
      left: {
        value: usdPrice != null ? uiAmount * usdPrice : null,
        correct: true,
        hint: '× usdPrice',
      },
      right: {
        value: usdPrescaled != null ? uiAmount * usdPrescaled : null,
        correct: false,
        hint: '× usdPricePrescaled → wrong × m',
      },
    },
    {
      label: 'raw amount (amount/10^decimals)',
      amountLabel: `${rawAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} raw units`,
      left: {
        value: usdPrice != null ? rawAmount * usdPrice : null,
        correct: false,
        hint: '× usdPrice → wrong ÷ m',
      },
      right: {
        value: usdPrescaled != null ? rawAmount * usdPrescaled : null,
        correct: true,
        hint: '× usdPricePrescaled',
      },
    },
  ];

  const wrongRatio =
    m !== 0 && Number.isFinite(m) ? m * m : null; // for SPACEX m=5 → 25×

  const ts = row.scaled.newMultiplierEffectiveTimestamp;
  const tsIso =
    ts > 0 ? new Date(ts * 1000).toISOString() : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Token
          <select
            value={row.symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
          >
            {rows.map((r) => (
              <option key={r.mint} value={r.symbol}>
                {r.symbol}
                {r.effectiveMultiplier !== 1
                  ? ` (m=${r.effectiveMultiplier})`
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="font-mono text-xs text-[var(--muted)]">
          Fixed position:{' '}
          <span className="text-[var(--foreground)] tabular-nums">
            {POSITION.toLocaleString()}
          </span>{' '}
          tokens (display / uiAmount)
        </div>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          Multiplier source
        </h2>
        <dl className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Effective m</dt>
            <dd className="text-lg tabular-nums text-[var(--foreground)]">
              {fmtMult(m)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Source</dt>
            <dd className="text-[var(--foreground)]">
              getScaledUiAmountConfig via {row.scaled.source}
              {row.scaled.hasScaledUiAmount ? '' : ' (identity m=1)'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">multiplier → newMultiplier</dt>
            <dd className="tabular-nums">
              {row.scaled.multiplier} → {row.scaled.newMultiplier}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">
              newMultiplierEffectiveTimestamp (≥ rule)
            </dt>
            <dd className="tabular-nums break-all">
              {ts > 0 ? (
                <>
                  {ts}
                  {tsIso ? (
                    <span className="block text-[var(--muted)]">{tsIso}</span>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
        {wrongRatio != null && m !== 1 ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Crossing conventions on a fixed uiAmount mis-values the position by{' '}
            <span className="font-mono tabular-nums text-[var(--warn)]">
              {wrongRatio}×
            </span>{' '}
            (m²). For {row.symbol} m={m}, wrong cells differ by {wrongRatio}×.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th className="px-3 py-2 text-left font-medium">Amount basis</th>
              <th className="px-3 py-2 text-right font-medium">
                × usdPrice (display)
              </th>
              <th className="px-3 py-2 text-right font-medium">
                × usdPricePrescaled (raw)
              </th>
            </tr>
          </thead>
          <tbody>
            {cells.map((rowCell) => (
              <tr
                key={rowCell.label}
                className="border-b border-[var(--border)]/60"
              >
                <td className="px-3 py-3">
                  <div className="font-mono text-xs text-[var(--foreground)]">
                    {rowCell.label}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">
                    {rowCell.amountLabel}
                  </div>
                </td>
                <MatrixCell cell={rowCell.left} />
                <MatrixCell cell={rowCell.right} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          Side-by-side prices · {row.symbol}
        </h2>
        <dl className="mt-3 grid gap-3 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[var(--muted)]">PreStocks API tokenPrice</dt>
            <dd className="mt-1 text-base tabular-nums">
              {fmtUsdPrice(row.prestocksTokenPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Jupiter usdPrice</dt>
            <dd className="mt-1 text-base tabular-nums">
              {fmtUsdPrice(row.jupiterUsdPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Jupiter usdPricePrescaled</dt>
            <dd className="mt-1 text-base tabular-nums">
              {fmtUsdPrice(row.jupiterUsdPricePrescaled)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          Third-party aggregators have published{' '}
          <span className="text-[var(--foreground)]">raw / prescaled</span>{' '}
          prices without clear labels — easy to confuse with display{' '}
          <span className="text-[var(--foreground)]">usdPrice</span>. Observed
          on Jupiter Price v3 for PreStocks ScaledUiAmount mints (date-stamped{' '}
          <time dateTime="2026-09-22">22 Sep 2026+</time>). See{' '}
          <a
            className="text-[var(--accent)] underline-offset-2 hover:underline"
            href="https://lite-api.jup.ag/price/v3"
            target="_blank"
            rel="noreferrer"
          >
            lite-api.jup.ag/price/v3
          </a>
          . Pair <code className="text-[var(--foreground)]">usdPrice</code> with
          scaled amounts; pair{' '}
          <code className="text-[var(--foreground)]">usdPricePrescaled</code>{' '}
          with raw / 10^decimals.
        </p>
      </div>
    </div>
  );
}

function MatrixCell({
  cell,
}: {
  cell: {
    value: number | null;
    correct: boolean;
    hint: string;
  };
}) {
  const ok = cell.correct;
  return (
    <td
      className={`px-3 py-3 text-right ${
        ok
          ? 'bg-[var(--positive)]/10'
          : 'bg-[var(--negative)]/10'
      }`}
    >
      <div
        className={`font-mono text-base tabular-nums font-semibold ${
          ok ? 'text-[var(--positive)]' : 'text-[var(--negative)] line-through'
        }`}
      >
        {cell.value == null
          ? '—'
          : `$${cell.value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
      </div>
      <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
        {ok ? 'correct' : 'wrong'} · {cell.hint}
      </div>
    </td>
  );
}
