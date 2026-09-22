import { IpoLadders } from '@/components/IpoLadders';
import { loadIpoLadders } from '@/lib/data/polymarket';
import { loadTokenBundle } from '@/lib/data/tokens';

export const dynamic = 'force-dynamic';

export default async function IpoPage() {
  const [ipo, tokens] = await Promise.all([
    loadIpoLadders(),
    loadTokenBundle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="font-mono text-lg font-semibold tracking-wide">
          IPO term structure
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
          Polymarket probability ladders for PreStocks-related IPO timing
          markets (gamma-api). Optional scatter vs token discount is an
          observation only — no fitted line.
        </p>
      </div>

      <IpoLadders bundle={ipo} tokens={tokens.rows} />
    </main>
  );
}
