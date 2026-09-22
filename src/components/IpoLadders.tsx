import type { IpoBundle, IpoEventLadder } from '@/lib/data/polymarket';
import type { TokenRow } from '@/lib/domain';
import { fmtPct } from '@/lib/format';
import { StaleBadge } from '@/components/StaleBadge';

export function IpoLadders({
  bundle,
  tokens,
}: {
  bundle: IpoBundle;
  tokens: TokenRow[];
}) {
  const discountBySymbol = new Map(
    tokens.map((t) => [t.symbol, t.premiumPct]),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <StaleBadge
          stale={bundle.source !== 'live'}
          asOf={bundle.asOf}
          snapshotFile={bundle.snapshotFile}
        />
        {bundle.error ? (
          <span className="font-mono text-[10px] text-[var(--warn)]">
            live error: {bundle.error}
          </span>
        ) : null}
      </div>

      {bundle.events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No Polymarket IPO events loaded. Expected slugs: openai-ipo-by,
          anthropic-ipo-by, spacex-ipo-by.
        </p>
      ) : (
        bundle.events.map((ev) => (
          <EventLadder
            key={ev.slug}
            event={ev}
            discountPct={
              ev.relatedSymbol
                ? (discountBySymbol.get(ev.relatedSymbol) ?? null)
                : null
            }
          />
        ))
      )}

      <ScatterObs bundle={bundle} tokens={tokens} />
    </div>
  );
}

function EventLadder({
  event,
  discountPct,
}: {
  event: IpoEventLadder;
  discountPct: number | null;
}) {
  return (
    <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold tracking-wide">
          {event.title}
        </h2>
        <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--muted)]">
          {event.relatedSymbol ? (
            <span>
              {event.relatedSymbol} token premium{' '}
              <span
                className={`tabular-nums ${
                  (discountPct ?? 0) >= 0
                    ? 'text-[var(--positive)]'
                    : 'text-[var(--negative)]'
                }`}
              >
                {fmtPct(discountPct)}
              </span>
            </span>
          ) : null}
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            Polymarket ↗
          </a>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {event.markets.map((m) => {
          const pct = m.yesProb != null ? m.yesProb * 100 : null;
          return (
            <div key={m.slug || m.question} className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--foreground)]">
                {pct == null ? '—' : `${pct.toFixed(1)}%`}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded bg-[var(--border)]">
                <div
                  className="h-full rounded bg-[var(--accent)]"
                  style={{
                    width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">
                {m.question}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScatterObs({
  bundle,
  tokens,
}: {
  bundle: IpoBundle;
  tokens: TokenRow[];
}) {
  // Observation: for each event, take nearest cumulative "by date" market with
  // meaningful yes prob, plot months vs token discount. No regression.
  const points: {
    symbol: string;
    months: number;
    discount: number;
    label: string;
  }[] = [];

  for (const ev of bundle.events) {
    if (!ev.relatedSymbol) continue;
    const token = tokens.find((t) => t.symbol === ev.relatedSymbol);
    if (!token || token.premiumPct == null) continue;
    // Prefer a mid ladder rung with yes in (0.05, 0.95), else first with months
    const candidate =
      ev.markets.find(
        (m) =>
          m.impliedMonthsToIpo != null &&
          m.yesProb != null &&
          m.yesProb > 0.05 &&
          m.yesProb < 0.95,
      ) ??
      ev.markets.find((m) => m.impliedMonthsToIpo != null && m.yesProb != null);
    if (!candidate || candidate.impliedMonthsToIpo == null) continue;
    points.push({
      symbol: ev.relatedSymbol,
      months: candidate.impliedMonthsToIpo,
      discount: token.premiumPct,
      label: candidate.question,
    });
  }

  const hasRelationship =
    points.length >= 3 &&
    (() => {
      // crude: check if sorting by months produces monotonic discounts
      const sorted = [...points].sort((a, b) => a.months - b.months);
      let inc = 0;
      let dec = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.discount > sorted[i - 1]!.discount) inc++;
        if (sorted[i]!.discount < sorted[i - 1]!.discount) dec++;
      }
      return inc === sorted.length - 1 || dec === sorted.length - 1;
    })();

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
        Observation · months-to-IPO vs token discount
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        Scatter of PreStocks token premium/discount vs implied months to a
        Polymarket IPO deadline. Presented as observation only —{' '}
        <strong className="font-medium text-[var(--foreground)]">
          no regression line
        </strong>
        .
      </p>

      {points.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Insufficient paired points (need token premium + IPO ladder dates).
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox="0 0 480 220"
              className="h-auto w-full max-w-xl text-[var(--foreground)]"
              role="img"
              aria-label="Scatter of months to IPO vs premium"
            >
              <line
                x1="48"
                y1="180"
                x2="460"
                y2="180"
                stroke="currentColor"
                strokeOpacity="0.25"
              />
              <line
                x1="48"
                y1="20"
                x2="48"
                y2="180"
                stroke="currentColor"
                strokeOpacity="0.25"
              />
              {(() => {
                const xs = points.map((p) => p.months);
                const ys = points.map((p) => p.discount);
                const minX = Math.min(...xs, 0);
                const maxX = Math.max(...xs, 1);
                const minY = Math.min(...ys, -30);
                const maxY = Math.max(...ys, 10);
                const xScale = (x: number) =>
                  48 + ((x - minX) / (maxX - minX || 1)) * 400;
                const yScale = (y: number) =>
                  180 - ((y - minY) / (maxY - minY || 1)) * 150;
                return points.map((p) => (
                  <g key={p.symbol}>
                    <circle
                      cx={xScale(p.months)}
                      cy={yScale(p.discount)}
                      r="5"
                      fill="var(--accent)"
                    />
                    <text
                      x={xScale(p.months) + 8}
                      y={yScale(p.discount) + 4}
                      className="fill-current"
                      fontSize="10"
                      fontFamily="var(--font-geist-mono), monospace"
                    >
                      {p.symbol}
                    </text>
                  </g>
                ));
              })()}
              <text
                x="240"
                y="210"
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                fillOpacity="0.5"
                fontFamily="var(--font-geist-mono), monospace"
              >
                implied months to IPO →
              </text>
              <text
                x="14"
                y="100"
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                fillOpacity="0.5"
                fontFamily="var(--font-geist-mono), monospace"
                transform="rotate(-90 14 100)"
              >
                premium %
              </text>
            </svg>
          </div>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-[var(--muted)]">
            {points.map((p) => (
              <li key={p.symbol}>
                <span className="text-[var(--foreground)]">{p.symbol}</span> ·{' '}
                {p.months.toFixed(1)} mo · {fmtPct(p.discount)} · {p.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">
            {hasRelationship
              ? 'With this sparse sample, points happen to align monotonically — treat as coincidence, not a fitted model.'
              : 'No clear monotonic relationship in this sparse sample (n=' +
                points.length +
                '). Saying so explicitly: relationship absent / inconclusive.'}
          </p>
        </>
      )}
    </section>
  );
}
