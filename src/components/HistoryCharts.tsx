'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  STATS_SYMBOLS,
  SYMBOL_COLORS,
  cumulativeVolumeSeries,
  dailyVolumeSeries,
  holdersSeries,
  downsample,
  tailSeries,
  type ChartRow,
} from '@/lib/stats/history';
import type { PrestocksStatsPayload } from '@/lib/domain';

type WindowKey = '90d' | '180d' | 'all';

const WINDOWS: { key: WindowKey; label: string; days: number }[] = [
  { key: '90d', label: '90d', days: 90 },
  { key: '180d', label: '180d', days: 180 },
  { key: 'all', label: 'All', days: 0 },
];

function fmtAxisUsd(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtTipUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtTipInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function shortDate(t: string): string {
  if (t.length >= 10) return t.slice(5, 10);
  return t;
}

function applyWindow(rows: ChartRow[], days: number): ChartRow[] {
  if (days <= 0) return rows;
  return tailSeries(rows, days);
}

function ChartShell({
  title,
  source,
  children,
  note,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider">
          {title}
        </h2>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          source: {source}
        </span>
      </div>
      <div className="h-56 w-full sm:h-72">{children}</div>
      {note ? (
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
          {note}
        </p>
      ) : null}
    </section>
  );
}

function VolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort(
    (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0),
  );
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <div className="mb-1 text-[var(--muted)]">{label}</div>
      {sorted.slice(0, 9).map((p) => (
        <div key={String(p.dataKey)} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{String(p.dataKey)}</span>
          <span className="tabular-nums">{fmtTipUsd(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function HoldersTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort(
    (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0),
  );
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <div className="mb-1 text-[var(--muted)]">week {label}</div>
      {sorted.map((p) => (
        <div key={String(p.dataKey)} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{String(p.dataKey)}</span>
          <span className="tabular-nums">{fmtTipInt(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function HistoryCharts({ stats }: { stats: PrestocksStatsPayload }) {
  const [windowKey, setWindowKey] = useState<WindowKey>('90d');
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const days = WINDOWS.find((w) => w.key === windowKey)?.days ?? 90;

  const { cumulative, daily, holders, symbols } = useMemo(() => {
    const symbols = (stats.volumeSymbols?.length
      ? stats.volumeSymbols
      : STATS_SYMBOLS
    ).filter((s): s is string => typeof s === 'string');

    let cum = cumulativeVolumeSeries(stats, symbols);
    let day = dailyVolumeSeries(stats, symbols);
    let hold = holdersSeries(
      stats,
      (stats.holderSymbols?.length ? stats.holderSymbols : symbols).filter(
        (s): s is string => typeof s === 'string',
      ),
    );

    cum = applyWindow(cum, days);
    day = applyWindow(day, days);
    hold = days > 0 ? tailSeries(hold, Math.ceil(days / 7) + 1) : hold;

    cum = downsample(cum, 120);
    day = downsample(day, 120);

    return { cumulative: cum, daily: day, holders: hold, symbols };
  }, [stats, days]);

  const visible = symbols.filter((s) => !hidden[s]);

  function toggle(sym: string) {
    setHidden((h) => ({ ...h, [sym]: !h[sym] }));
  }

  const axisStyle = {
    fontSize: 10,
    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
    fill: 'var(--muted)',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          window
        </span>
        <div className="inline-flex rounded border border-[var(--border)] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWindowKey(w.key)}
              className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                windowKey === w.key
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 sm:ml-auto">
          {symbols.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide ${
                hidden[s]
                  ? 'border-[var(--border)] text-[var(--muted)] opacity-40'
                  : 'border-[var(--border)] text-[var(--foreground)]'
              }`}
              style={
                hidden[s]
                  ? undefined
                  : { borderColor: SYMBOL_COLORS[s] ?? 'var(--accent)' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <ChartShell
        title="Cumulative volume (USD)"
        source="PreStocks /api/stats · volume[]"
        note="Series is cumulative lifetime USD volume per symbol — not daily turnover."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulative} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={shortDate} tick={axisStyle} minTickGap={28} />
            <YAxis tickFormatter={fmtAxisUsd} tick={axisStyle} width={52} />
            <Tooltip content={<VolumeTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} iconSize={8} />
            {visible.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stackId="1"
                stroke={SYMBOL_COLORS[s] ?? '#888'}
                fill={SYMBOL_COLORS[s] ?? '#888'}
                fillOpacity={0.35}
                strokeWidth={1}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        title="Daily volume (differenced)"
        source="PreStocks /api/stats · Δ cumulative"
        note="Day-over-day difference of the cumulative series. Negative deltas floored at 0 for stacking. More honest view of activity than the cumulative chart alone."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={shortDate} tick={axisStyle} minTickGap={28} />
            <YAxis tickFormatter={fmtAxisUsd} tick={axisStyle} width={52} />
            <Tooltip content={<VolumeTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} iconSize={8} />
            {visible.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stackId="1"
                stroke={SYMBOL_COLORS[s] ?? '#888'}
                fill={SYMBOL_COLORS[s] ?? '#888'}
                fillOpacity={0.4}
                strokeWidth={1}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        title="Holder growth (weekly)"
        source="PreStocks /api/stats · holders[]"
        note="Weekly holder counts from /api/stats only — not mixed with /api/metrics holderCount (different methodology / cadence)."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={holders} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={shortDate} tick={axisStyle} minTickGap={28} />
            <YAxis
              tickFormatter={(n: number) =>
                n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)
              }
              tick={axisStyle}
              width={44}
            />
            <Tooltip content={<HoldersTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} iconSize={8} />
            {visible.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={SYMBOL_COLORS[s] ?? '#888'}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
