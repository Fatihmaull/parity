'use client';

import type { TokenRow } from '@/lib/domain';
import {
  markForConvention,
  priceForConvention,
} from '@/lib/domain';
import { useConvention } from '@/components/ConventionContext';
import { fmtInt, fmtMult, fmtPct, fmtUsd, fmtUsdPrice } from '@/lib/format';

export function TerminalTable({ rows }: { rows: TokenRow[] }) {
  const { convention } = useConvention();

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 font-medium text-right">Token price</th>
            <th className="px-3 py-2 font-medium text-right">Mark</th>
            <th className="px-3 py-2 font-medium text-right">Premium</th>
            <th className="px-3 py-2 font-medium text-right">Eff. mult</th>
            <th className="px-3 py-2 font-medium text-right">Liquidity</th>
            <th
              className="px-3 py-2 font-medium text-right"
              title="DexScreener h24 when available; else PreStocks stats day-over-day delta"
            >
              24h vol
            </th>
            <th className="px-3 py-2 font-medium text-right">Holders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const price = priceForConvention(row, convention);
            const mark = markForConvention(row, convention);
            const prem = row.premiumPct;
            const premClass =
              prem == null
                ? 'text-[var(--muted)]'
                : prem > 0
                  ? 'text-[var(--positive)]'
                  : prem < 0
                    ? 'text-[var(--negative)]'
                    : 'text-[var(--foreground)]';

            return (
              <tr
                key={row.mint}
                className={`border-b border-[var(--border)]/60 hover:bg-[var(--row-hover)] ${
                  row.anomaly ? 'bg-[var(--anomaly-bg)]' : ''
                }`}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tracking-wide">
                      {row.symbol}
                    </span>
                    <span className="rounded border border-[var(--border)] px-1 py-px font-mono text-[9px] uppercase text-[var(--muted)]">
                      PreStocks
                    </span>
                    {row.anomaly ? (
                      <span className="rounded border border-[var(--negative)]/40 px-1 py-px font-mono text-[9px] uppercase text-[var(--negative)]">
                        flag
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums">
                  {fmtUsdPrice(price)}
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums text-[var(--muted)]">
                  {fmtUsdPrice(mark)}
                </td>
                <td
                  className={`num px-3 py-2 text-right font-mono tabular-nums font-medium ${premClass}`}
                >
                  {fmtPct(prem)}
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums">
                  {fmtMult(row.effectiveMultiplier)}
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums text-[var(--muted)]">
                  {fmtUsd(row.liquidityUsd, 0)}
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums text-[var(--muted)]">
                  {fmtUsd(row.volume24hUsd, 0)}
                </td>
                <td className="num px-3 py-2 text-right font-mono tabular-nums">
                  {fmtInt(row.holders)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
