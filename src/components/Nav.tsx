'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConvention } from '@/components/ConventionContext';

const LINKS = [
  { href: '/', label: 'Terminal' },
  { href: '/history', label: 'History' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/convention', label: 'Convention Check' },
  { href: '/ipo', label: 'IPO' },
  { href: '/disclosures', label: 'Disclosures' },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { convention, setConvention } = useConvention();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-widest text-[var(--accent)]"
          >
            PARITY
          </Link>
          <nav className="flex flex-wrap gap-1">
            {LINKS.map((l) => {
              const active =
                l.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded px-2.5 py-1 font-mono text-xs tracking-wide transition-colors ${
                    active
                      ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] sm:inline"
            title="Premium % is always computed from display prices — this toggle never changes it"
          >
            convention
          </span>
          <div
            className="inline-flex rounded border border-[var(--border)] p-0.5 font-mono text-xs"
            role="group"
            aria-label="Price convention"
          >
            <button
              type="button"
              onClick={() => setConvention('display')}
              className={`rounded px-2.5 py-1 transition-colors ${
                convention === 'display'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Display
            </button>
            <button
              type="button"
              onClick={() => setConvention('raw')}
              className={`rounded px-2.5 py-1 transition-colors ${
                convention === 'raw'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Raw
            </button>
          </div>
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              convention === 'display'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-[var(--warn)] text-[var(--warn)]'
            }`}
          >
            {convention}
          </span>
        </div>
      </div>
    </header>
  );
}
