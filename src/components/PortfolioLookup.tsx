'use client';

import { useCallback, useState } from 'react';
import { fmtMult, fmtUsd, fmtUsdPrice } from '@/lib/format';

interface Valuation {
  rawUnits: number | null;
  uiAmount: number | null;
  valueDisplay: number | null;
  valueRawConvention: number | null;
  crossedScaledTimesPrescaled: number | null;
  crossedRawTimesUsdPrice: number | null;
}

interface Holding {
  symbol: string;
  mint: string;
  amountRaw: string;
  decimals: number;
  uiAmount: number | null;
  effectiveMultiplier: number;
  usdPrice: number | null;
  usdPricePrescaled: number | null;
  valuation: Valuation;
  tokenAccount: string;
}

interface OkResult {
  ok: true;
  address: string;
  rpcUrlHost: string;
  holdings: Holding[];
  totalDisplayUsd: number;
  totalCrossedUsd: number;
  empty: boolean;
  priceSource?: string;
}

interface ErrResult {
  ok: false;
  error: string;
  code?: string;
}

type Result = OkResult | ErrResult;

function shortMint(m: string): string {
  return `${m.slice(0, 4)}…${m.slice(-4)}`;
}

export function PortfolioLookup({ initialAddress = '' }: { initialAddress?: string }) {
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const lookup = useCallback(async (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) {
      setResult({
        ok: false,
        error: 'Paste a Solana address to look up PreStocks holdings.',
        code: 'invalid_address',
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/portfolio?address=${encodeURIComponent(trimmed)}`,
        { cache: 'no-store' },
      );
      const data = (await res.json()) as Result;
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        code: 'unknown',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(address);
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Solana address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste any base58 pubkey…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[var(--accent)] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--on-accent)] disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Lookup'}
        </button>
      </form>

      <p className="font-mono text-[10px] leading-relaxed text-[var(--muted)]">
        No wallet adapter — address paste only. Token-2022 accounts filtered to
        the PreStocks universe. RPC <code className="text-[var(--foreground)]">uiAmount</code>{' '}
        already includes ScaledUiAmount; correct value pairs it with{' '}
        <code className="text-[var(--foreground)]">usdPrice</code>.
      </p>

      {result && !result.ok ? (
        <div className="rounded border border-[var(--negative)]/40 bg-[var(--anomaly-bg)] p-3 font-mono text-xs text-[var(--negative)]">
          {result.error}
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-[var(--muted)]">
            <span>
              owner{' '}
              <span className="text-[var(--foreground)]">{shortMint(result.address)}</span>
            </span>
            <span>rpc {result.rpcUrlHost}</span>
            {result.priceSource ? <span>prices {result.priceSource}</span> : null}
          </div>

          {result.empty ? (
            <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
              <p className="font-mono text-sm text-[var(--muted)]">
                No PreStocks universe Token-2022 holdings for this address.
              </p>
              <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                Empty wallet, wrong address, or only non-universe / legacy SPL
                tokens.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Correct (display)
                  </div>
                  <div className="mt-1 font-mono text-xl tabular-nums text-[var(--foreground)]">
                    {fmtUsd(result.totalDisplayUsd)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                    uiAmount × usdPrice
                  </div>
                </div>
                <div className="rounded border border-[var(--warn)]/40 bg-[var(--warn)]/5 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--warn)]">
                    What other tools might show
                  </div>
                  <div className="mt-1 font-mono text-xl tabular-nums text-[var(--warn)]">
                    {fmtUsd(result.totalCrossedUsd)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                    crossed convention (uiAmount × usdPricePrescaled when m≠1)
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)]">
                <table className="w-full min-w-[640px] border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">uiAmount</th>
                      <th className="px-3 py-2 text-right">m</th>
                      <th className="px-3 py-2 text-right">usdPrice</th>
                      <th className="px-3 py-2 text-right">Correct $</th>
                      <th className="px-3 py-2 text-right">Crossed $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.holdings.map((h) => {
                      const crossed =
                        h.effectiveMultiplier !== 1
                          ? h.valuation.crossedScaledTimesPrescaled
                          : h.valuation.valueDisplay;
                      return (
                        <tr
                          key={h.tokenAccount}
                          className="border-b border-[var(--border)]/60 hover:bg-[var(--row-hover)]"
                        >
                          <td className="px-3 py-2">
                            <div className="font-semibold">{h.symbol}</div>
                            <div className="text-[10px] text-[var(--muted)]">
                              {shortMint(h.mint)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.uiAmount != null
                              ? h.uiAmount.toLocaleString('en-US', {
                                  maximumFractionDigits: 4,
                                })
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMult(h.effectiveMultiplier)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtUsdPrice(h.usdPrice)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[var(--positive)]">
                            {fmtUsd(h.valuation.valueDisplay)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[var(--warn)]">
                            {fmtUsd(crossed)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="font-mono text-[10px] leading-relaxed text-[var(--muted)]">
                Crossed row intentionally pairs scaled uiAmount with
                usdPricePrescaled (or raw units with usdPrice) to illustrate the
                m / m² mis-valuation bug. Correct row never double-applies the
                multiplier.
              </p>
            </>
          )}
        </div>
      ) : null}

      {!result && !loading ? (
        <div className="rounded border border-dashed border-[var(--border)] bg-[var(--panel)] p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            Paste an address to inspect PreStocks holdings.
          </p>
          <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
            Live RPC required — snapshots cannot fake arbitrary wallets.
          </p>
        </div>
      ) : null}
    </div>
  );
}
