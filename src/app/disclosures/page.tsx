export default function DisclosuresPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <h1 className="font-mono text-lg font-semibold tracking-wide">
        Disclosures
      </h1>

      <section className="space-y-3 text-sm leading-relaxed text-[var(--foreground)]">
        <p>
          PARITY is a read-only analytics surface for{' '}
          <strong className="font-semibold">PreStocks</strong> tokens on Solana.
          Nothing here is an offer to buy or sell securities, investment advice,
          or a recommendation.
        </p>

        <p>
          PreStocks tokens are structured as{' '}
          <strong className="font-semibold">Reg S</strong> instruments for
          eligible <strong className="font-semibold">non-US persons</strong>.
          What a holder receives is{' '}
          <strong className="font-semibold">economic exposure</strong> via an
          SPV — not ownership of the private company, not voting rights, and not
          dividends or distributions from that company.
        </p>

        <p className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 font-mono text-xs text-[var(--muted)]">
          Language rule used throughout PARITY: never describe token holders as
          having ownership, shares, equity, or a stake in the underlying
          company. Prefer &ldquo;economic exposure&rdquo; / &ldquo;SPV
          exposure.&rdquo;
        </p>

        <h2 className="pt-2 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          May 2026 SPV statements
        </h2>
        <p>
          In May 2026, Anthropic and OpenAI published warnings that certain
          unauthorized transfers of their private-company interests — including
          some SPV / tokenized structures — may be void or carry no economic
          value without board approval. PreStocks publicly responded that its
          live tokens remain backed under their terms and emphasize economic
          exposure rather than cap-table ownership. Independent reporting:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <a
              className="text-[var(--accent)] hover:underline"
              href="https://www.coindesk.com/markets/2026/05/13/anthropic-openai-tokens-plunge-nearly-40-as-ai-firms-warn-spv-transfers-are-invalid"
              target="_blank"
              rel="noreferrer"
            >
              CoinDesk — Anthropic / OpenAI SPV transfer warnings (13 May 2026)
            </a>
          </li>
          <li>
            <a
              className="text-[var(--accent)] hover:underline"
              href="https://decrypt.co/367614/anthropic-openai-warn-unauthorized-ai-startup-stock-worthless-spv"
              target="_blank"
              rel="noreferrer"
            >
              Decrypt — unauthorized AI startup share / SPV warning
            </a>
          </li>
          <li>
            <a
              className="text-[var(--accent)] hover:underline"
              href="https://thecoinformer.com/news/prestocks-says-tokenized-stocks-remain-backed-despite-anthropic-warning"
              target="_blank"
              rel="noreferrer"
            >
              The Coinformer — PreStocks response (economic exposure / Reg S)
            </a>
          </li>
        </ul>

        <h2 className="pt-2 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          Data &amp; correctness
        </h2>
        <p>
          Mark prices prefer PreStocks catalogue{' '}
          <code className="text-xs">markPrice</code>; Jupiter{' '}
          <code className="text-xs">stockData.price</code> is fallback only.
          Token premiums always use display convention prices so Display⇄Raw
          never changes the premium percentage. ScaledUiAmount multipliers come
          from on-chain <code className="text-xs">getScaledUiAmountConfig</code>{' '}
          with the ≥ timestamp rule.
        </p>

        <p className="text-xs text-[var(--muted)]">
          Scope locked: PreStocks-only. Tessera tokens are out of scope for this
          bounty build.
        </p>
      </section>
    </main>
  );
}
