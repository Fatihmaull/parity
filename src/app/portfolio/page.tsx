import { PortfolioLookup } from '@/components/PortfolioLookup';

export const dynamic = 'force-dynamic';

export default function PortfolioPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="font-mono text-lg font-semibold tracking-wide">
          Portfolio
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
          Paste any Solana address — no wallet connect. Shows PreStocks-universe
          Token-2022 holdings valued with the display convention (uiAmount ×
          usdPrice), plus a crossed-convention comparison for ScaledUiAmount
          bugs.
        </p>
      </div>

      <PortfolioLookup />

      <p className="font-mono text-[10px] text-[var(--muted)]">
        Economic exposure via Reg S SPV structures — not ownership. See{' '}
        <a href="/disclosures" className="text-[var(--accent)] hover:underline">
          Disclosures
        </a>
        .
      </p>
    </main>
  );
}
