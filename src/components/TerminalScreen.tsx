'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { TokenRow } from '@/lib/domain';
import {
  markForConvention,
  priceForConvention,
} from '@/lib/domain';
import { useConvention } from '@/components/ConventionContext';
import {
  fmtInt,
  fmtMult,
  fmtPct,
  fmtUsd,
  fmtUsdPrice,
} from '@/lib/format';
import {
  SCREENER_PRESETS,
  applyPreset,
  applySymbolFilter,
  presetById,
  type ScreenerPresetId,
} from '@/lib/screen/presets';
import { QUALITY_FORMULA_TOOLTIP } from '@/lib/screen/quality';
import { misleadingPremium } from '@/lib/screen/misleading';

const WATCH_KEY = 'parity.watchlist';
const THRESH_KEY = 'parity.alertThreshold';
const DEFAULT_THRESHOLD = 20;

export type TerminalMeta = {
  asOf: string | null;
  stale: boolean;
};

function dataAgeLabel(asOf: string | null): string {
  if (!asOf) return 'age n/a';
  const ms = Date.now() - Date.parse(asOf);
  if (!Number.isFinite(ms) || ms < 0) return 'age n/a';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function dataAgeSec(asOf: string | null): number | null {
  if (!asOf) return null;
  const ms = Date.now() - Date.parse(asOf);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 1000);
}

function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

function saveWatchlist(symbols: string[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(symbols));
}

function loadThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLD;
  try {
    const raw = localStorage.getItem(THRESH_KEY);
    if (!raw) return DEFAULT_THRESHOLD;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

function downloadCsv(filename: string, rows: TokenRow[], convention: 'display' | 'raw') {
  const header = [
    'symbol',
    'price',
    'mark',
    'premiumPct',
    'effMult',
    'liquidityUsd',
    'volume24hUsd',
    'holders',
    'qualityScore',
    'impliedMonthsToIpo',
    'dexPriceUsd',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    const price = priceForConvention(r, convention);
    const mark = markForConvention(r, convention);
    lines.push(
      [
        r.symbol,
        price ?? '',
        mark ?? '',
        r.premiumPct ?? '',
        r.effectiveMultiplier,
        r.liquidityUsd ?? '',
        r.volume24hUsd ?? '',
        r.holders ?? '',
        r.qualityScore,
        r.impliedMonthsToIpo ?? '',
        r.dexPriceUsd ?? '',
      ].join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TerminalScreen({
  rows,
  meta,
}: {
  rows: TokenRow[];
  meta: TerminalMeta;
}) {
  const { convention } = useConvention();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialPreset = presetById(searchParams.get('preset')).id;
  const initialSymbols = (() => {
    const s = searchParams.get('symbols');
    if (!s) return null as string[] | null;
    return s
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
  })();

  const [presetId, setPresetId] = useState<ScreenerPresetId>(initialPreset);
  const [symbolFilter, setSymbolFilter] = useState<string[] | null>(
    initialSymbols,
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [toast, setToast] = useState<string | null>(null);
  const [includeWatchedInExport, setIncludeWatchedInExport] = useState(false);
  const [ipoMaxMonths, setIpoMaxMonths] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWatchlist(loadWatchlist());
    setThreshold(loadThreshold());
    setHydrated(true);
  }, []);

  const filtered = useMemo(() => {
    let out = applyPreset(rows, presetId);
    out = applySymbolFilter(out, symbolFilter);
    const maxM = Number(ipoMaxMonths);
    if (Number.isFinite(maxM) && maxM > 0) {
      out = out.filter(
        (r) =>
          r.impliedMonthsToIpo != null && r.impliedMonthsToIpo <= maxM,
      );
    }
    return out;
  }, [rows, presetId, symbolFilter, ipoMaxMonths]);

  const alerts = useMemo(() => {
    if (!hydrated) return [];
    return rows.filter(
      (r) =>
        watchlist.includes(r.symbol) &&
        r.premiumPct != null &&
        Math.abs(r.premiumPct) >= threshold,
    );
  }, [rows, watchlist, threshold, hydrated]);

  useEffect(() => {
    if (!hydrated || alerts.length === 0) return;
    const top = alerts[0]!;
    setToast(
      `Watch alert: ${top.symbol} |premium| ${fmtPct(top.premiumPct)} ≥ ${threshold}%`,
    );
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [hydrated, alerts, threshold]);

  const syncQuery = useCallback(
    (nextPreset: ScreenerPresetId, nextSymbols: string[] | null) => {
      const params = new URLSearchParams();
      if (nextPreset !== 'all') params.set('preset', nextPreset);
      if (nextSymbols && nextSymbols.length > 0) {
        params.set('symbols', nextSymbols.join(','));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = (id: ScreenerPresetId) => {
    setPresetId(id);
    if (id === 'all') setSymbolFilter(null);
    syncQuery(id, id === 'all' ? null : symbolFilter);
  };

  const toggleWatch = (symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      saveWatchlist(next);
      return next;
    });
  };

  const onThreshold = (v: number) => {
    setThreshold(v);
    localStorage.setItem(THRESH_KEY, String(v));
  };

  const exportRows = useMemo(() => {
    if (!includeWatchedInExport || watchlist.length === 0) return filtered;
    const bySym = new Map(rows.map((r) => [r.symbol, r]));
    const extra = watchlist
      .map((s) => bySym.get(s))
      .filter((r): r is TokenRow => !!r && !filtered.some((f) => f.mint === r.mint));
    return [...filtered, ...extra];
  }, [filtered, includeWatchedInExport, watchlist, rows]);

  const basketNotional = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const r of exportRows) {
      const p = priceForConvention(r, convention);
      if (p != null) {
        sum += p;
        n += 1;
      }
    }
    return { sum, n };
  }, [exportRows, convention]);

  const activePreset = presetById(presetId);
  const ageSec = dataAgeSec(meta.asOf);
  const ageLabel = dataAgeLabel(meta.asOf);

  const copyShareLink = async () => {
    const params = new URLSearchParams();
    if (presetId !== 'all') params.set('preset', presetId);
    const syms =
      symbolFilter && symbolFilter.length > 0
        ? symbolFilter
        : exportRows.map((r) => r.symbol);
    if (syms.length > 0 && syms.length < rows.length) {
      params.set('symbols', syms.join(','));
    }
    const url = `${window.location.origin}${pathname}${params.toString() ? `?${params}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Share link copied');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alerts banner */}
      {hydrated && alerts.length > 0 ? (
        <div className="rounded border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 font-mono text-[11px] text-[var(--warn)]">
          <span className="font-semibold uppercase tracking-wider">Watch alerts</span>
          {' · '}
          {alerts.map((a) => (
            <span key={a.symbol} className="mr-3 tabular-nums">
              {a.symbol}{' '}
              <span
                className={
                  (a.premiumPct ?? 0) >= 0
                    ? 'text-[var(--positive)]'
                    : 'text-[var(--negative)]'
                }
              >
                {fmtPct(a.premiumPct)}
              </span>
            </span>
          ))}
          <span className="text-[var(--muted)]">
            (threshold ±{threshold}%)
          </span>
        </div>
      ) : null}

      {toast ? (
        <div className="rounded border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-2 font-mono text-[11px] text-[var(--accent)]">
          {toast}
        </div>
      ) : null}

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Screener
        </span>
        {SCREENER_PRESETS.map((p) => {
          const active = p.id === presetId;
          return (
            <button
              key={p.id}
              type="button"
              title={p.description}
              onClick={() => setPreset(p.id)}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {presetId !== 'all' || (symbolFilter && symbolFilter.length > 0) ? (
          <span className="rounded border border-[var(--accent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
            active: {activePreset.short}
            {symbolFilter && symbolFilter.length > 0
              ? ` · ${symbolFilter.length} sym`
              : ''}
          </span>
        ) : null}
        <span
          className="ml-auto font-mono text-[10px] text-[var(--muted)]"
          title={meta.asOf ?? undefined}
        >
          data age {ageLabel}
          {meta.stale ? ' · stale' : ' · live'}
        </span>
      </div>

      {/* Watchlist + export controls */}
      <div className="flex flex-wrap items-end gap-3 rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
        <label className="flex flex-col gap-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Alert |premium| ≥ %
          <input
            type="number"
            min={1}
            max={200}
            value={threshold}
            onChange={(e) => onThreshold(Number(e.target.value) || DEFAULT_THRESHOLD)}
            className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-xs tabular-nums text-[var(--foreground)]"
          />
        </label>
        <label className="flex flex-col gap-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          IPO ≤ months
          <input
            type="number"
            min={0}
            placeholder="any"
            value={ipoMaxMonths}
            onChange={(e) => setIpoMaxMonths(e.target.value)}
            className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-xs tabular-nums text-[var(--foreground)]"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={includeWatchedInExport}
            onChange={(e) => setIncludeWatchedInExport(e.target.checked)}
          />
          export incl. watched
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-[var(--muted)]">
            basket ({basketNotional.n}×1){' '}
            <span className="tabular-nums text-[var(--foreground)]">
              {fmtUsd(basketNotional.sum, 2)}
            </span>{' '}
            <span className="text-[10px]">({convention})</span>
          </span>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `parity-basket-${presetId}.csv`,
                exportRows,
                convention,
              )
            }
            className="rounded border border-[var(--border)] px-2.5 py-1 font-mono text-[11px] text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded border border-[var(--border)] px-2.5 py-1 font-mono text-[11px] text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            Copy link
          </button>
        </div>
      </div>

      {hydrated && watchlist.length > 0 ? (
        <p className="font-mono text-[10px] text-[var(--muted)]">
          Watching:{' '}
          {watchlist.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleWatch(s)}
              className="mr-2 text-[var(--accent)] hover:underline"
              title="Remove from watchlist"
            >
              {s}×
            </button>
          ))}
        </p>
      ) : null}

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium text-right">Token price</th>
              <th className="px-3 py-2 font-medium text-right">Mark</th>
              <th className="px-3 py-2 font-medium text-right">Premium</th>
              <th className="px-3 py-2 font-medium text-right">Eff. mult</th>
              <th
                className="px-3 py-2 font-medium text-right"
                title={QUALITY_FORMULA_TOOLTIP}
              >
                Quality
              </th>
              <th
                className="px-3 py-2 font-medium text-right"
                title="Polymarket implied months to IPO (null if no market)"
              >
                IPO
              </th>
              <th className="px-3 py-2 font-medium text-right">Age</th>
              <th className="px-3 py-2 font-medium text-right">Liquidity</th>
              <th className="px-3 py-2 font-medium text-right">24h vol</th>
              <th className="px-3 py-2 font-medium text-right">Holders</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                >
                  No rows match this screen.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
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
                const isOpen = expanded === row.mint;
                const staleHigh =
                  meta.stale &&
                  prem != null &&
                  Math.abs(prem) > 20;
                const watching = watchlist.includes(row.symbol);
                const mis = misleadingPremium(row);

                return (
                  <Fragment key={row.mint}>
                    <tr
                      className={`border-b border-[var(--border)]/60 hover:bg-[var(--row-hover)] ${
                        row.anomaly ? 'bg-[var(--anomaly-bg)]' : ''
                      }`}
                    >
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                          onClick={() =>
                            setExpanded(isOpen ? null : row.mint)
                          }
                          className="font-mono text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            title={watching ? 'Unwatch' : 'Watch'}
                            onClick={() => toggleWatch(row.symbol)}
                            className={`font-mono text-[10px] ${
                              watching
                                ? 'text-[var(--warn)]'
                                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                            }`}
                          >
                            {watching ? '★' : '☆'}
                          </button>
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
                          {staleHigh ? (
                            <span
                              className="rounded border border-[var(--warn)]/40 px-1 py-px font-mono text-[9px] uppercase text-[var(--warn)]"
                              title="High |premium| on stale data — treat with caution"
                            >
                              stale+|prem|
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
                      <td
                        className="num px-3 py-2 text-right font-mono tabular-nums"
                        title={QUALITY_FORMULA_TOOLTIP}
                      >
                        {row.qualityScore}
                      </td>
                      <td className="num px-3 py-2 text-right font-mono tabular-nums text-[var(--muted)]">
                        {row.impliedMonthsToIpo == null
                          ? '—'
                          : row.impliedMonthsToIpo.toFixed(1)}
                      </td>
                      <td
                        className={`num px-3 py-2 text-right font-mono tabular-nums ${
                          staleHigh
                            ? 'text-[var(--warn)]'
                            : 'text-[var(--muted)]'
                        }`}
                        title={
                          ageSec != null
                            ? `${ageSec}s since asOf`
                            : meta.asOf ?? undefined
                        }
                      >
                        {ageLabel}
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
                    {isOpen ? (
                      <tr
                        className="border-b border-[var(--border)] bg-[var(--background)]/50"
                      >
                        <td colSpan={12} className="px-4 py-3">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                                Convention-safe compare
                              </h4>
                              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                                Correct premium uses display vs mark (invariant
                                under Display⇄Raw). If another screener mixes
                                raw/prescaled price with unscaled mark:
                              </p>
                              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                                <dt className="text-[var(--muted)]">Correct</dt>
                                <dd
                                  className={`tabular-nums ${
                                    (mis.correctPct ?? 0) >= 0
                                      ? 'text-[var(--positive)]'
                                      : 'text-[var(--negative)]'
                                  }`}
                                >
                                  {fmtPct(mis.correctPct)}
                                </dd>
                                <dt className="text-[var(--muted)]">
                                  Misleading (raw÷mark)
                                </dt>
                                <dd className="tabular-nums text-[var(--warn)]">
                                  {mis.differs
                                    ? fmtPct(mis.crossedPct)
                                    : 'same / n/a (m=1)'}
                                </dd>
                              </dl>
                            </div>
                            <div>
                              <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                                Cross-venue price sanity
                              </h4>
                              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                                <dt className="text-[var(--muted)]">
                                  PreStocks tokenPrice
                                </dt>
                                <dd className="tabular-nums">
                                  {fmtUsdPrice(row.prestocksTokenPrice)}
                                </dd>
                                <dt className="text-[var(--muted)]">
                                  Jupiter usdPrice
                                </dt>
                                <dd className="tabular-nums">
                                  {fmtUsdPrice(row.jupiterUsdPrice)}
                                </dd>
                                <dt className="text-[var(--muted)]">
                                  Jupiter usdPricePrescaled
                                </dt>
                                <dd className="tabular-nums">
                                  {fmtUsdPrice(row.jupiterUsdPricePrescaled)}
                                </dd>
                                <dt className="text-[var(--muted)]">
                                  DexScreener priceUsd
                                  <span className="ml-1 text-[9px] normal-case tracking-normal opacity-70">
                                    (likely raw)
                                  </span>
                                </dt>
                                <dd className="tabular-nums">
                                  {row.dexPriceUsd == null
                                    ? '— (429 / missing)'
                                    : fmtUsdPrice(row.dexPriceUsd)}
                                </dd>
                              </dl>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[10px] text-[var(--muted)]">
        Showing {filtered.length} / {rows.length} · Quality tooltip: hover column
        header · Star to watch (localStorage, no accounts)
      </p>
    </div>
  );
}
