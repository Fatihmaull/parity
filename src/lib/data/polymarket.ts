/**
 * Polymarket Gamma API — IPO term-structure ladders for PreStocks names.
 * Live first; snapshot fallback under src/data/snapshot/polymarket/latest.json
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { snapshotOnly } from '@/lib/data/liveOrSnapshot';

const GAMMA = 'https://gamma-api.polymarket.com';

/** PreStocks-related IPO event slugs (verified 22 Sep 2026). */
export const IPO_EVENT_SLUGS = [
  'openai-ipo-by',
  'anthropic-ipo-by',
  'spacex-ipo-by',
] as const;

export interface IpoLadderPoint {
  question: string;
  slug: string;
  /** Implied Yes probability 0–1 */
  yesProb: number | null;
  /** Best-effort deadline ISO */
  endDate: string | null;
  /** Months from asOf to endDate (observation axis) */
  impliedMonthsToIpo: number | null;
  volume: number | null;
}

export interface IpoEventLadder {
  slug: string;
  title: string;
  relatedSymbol: string | null;
  markets: IpoLadderPoint[];
  url: string;
}

export interface IpoBundle {
  source: 'live' | 'snapshot' | 'none';
  asOf: string;
  events: IpoEventLadder[];
  error?: string;
  snapshotFile?: string;
}

function parseJsonField<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

function monthsBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / (1000 * 60 * 60 * 24 * 30.4375);
}

function symbolForSlug(slug: string): string | null {
  if (slug.startsWith('openai')) return 'OPENAI';
  if (slug.startsWith('anthropic')) return 'ANTHROPIC';
  if (slug.startsWith('spacex')) return 'SPACEX';
  return null;
}

function ladderFromEvent(
  event: Record<string, unknown>,
  asOf: string,
): IpoEventLadder {
  const slug = String(event.slug ?? '');
  const marketsRaw = (event.markets as unknown[]) ?? [];
  const markets: IpoLadderPoint[] = [];

  for (const raw of marketsRaw) {
    const m = raw as Record<string, unknown>;
    const outcomes = parseJsonField<string[]>(m.outcomes) ?? [];
    const prices = parseJsonField<string[] | number[]>(m.outcomePrices) ?? [];
    const yesIdx = outcomes.findIndex(
      (o) => o.toLowerCase() === 'yes' || o === 'Yes',
    );
    const idx = yesIdx >= 0 ? yesIdx : 0;
    const p = prices[idx];
    const yesProb =
      p == null ? null : typeof p === 'number' ? p : Number(p);

    const endDate =
      (typeof m.endDate === 'string' && m.endDate) ||
      (typeof m.endDateIso === 'string' && m.endDateIso) ||
      (typeof event.endDate === 'string' && event.endDate) ||
      null;

    markets.push({
      question: String(m.question ?? ''),
      slug: String(m.slug ?? ''),
      yesProb: Number.isFinite(yesProb) ? yesProb : null,
      endDate,
      impliedMonthsToIpo: endDate ? monthsBetween(asOf, endDate) : null,
      volume: typeof m.volume === 'number' ? m.volume : Number(m.volume) || null,
    });
  }

  // Sort by endDate ascending for ladder
  markets.sort((a, b) => {
    const ta = a.endDate ? Date.parse(a.endDate) : 0;
    const tb = b.endDate ? Date.parse(b.endDate) : 0;
    return ta - tb;
  });

  return {
    slug,
    title: String(event.title ?? slug),
    relatedSymbol: symbolForSlug(slug),
    markets,
    url: `https://polymarket.com/event/${slug}`,
  };
}

async function fetchEventBySlug(
  slug: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${GAMMA}/events?slug=${encodeURIComponent(slug)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PARITY/0.1 (PreStocks analytics)',
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Polymarket slug=${slug} HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  if (Array.isArray(body) && body.length > 0) {
    return body[0] as Record<string, unknown>;
  }
  return null;
}

async function loadPolymarketSnapshot(): Promise<{
  file: string;
  data: { capturedAt?: string; events?: Record<string, unknown>[] };
} | null> {
  const file = path.join(
    process.cwd(),
    'src/data/snapshot/polymarket/latest.json',
  );
  try {
    const raw = await readFile(file, 'utf8');
    return { file: 'polymarket/latest.json', data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export async function loadIpoLadders(): Promise<IpoBundle> {
  const asOfLive = new Date().toISOString();

  if (!snapshotOnly()) {
    try {
      const events: IpoEventLadder[] = [];
      for (const slug of IPO_EVENT_SLUGS) {
        const ev = await fetchEventBySlug(slug);
        if (ev) events.push(ladderFromEvent(ev, asOfLive));
      }
      if (events.length > 0) {
        return { source: 'live', asOf: asOfLive, events };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const snap = await loadPolymarketSnapshot();
      if (snap?.data.events?.length) {
        const asOf = snap.data.capturedAt ?? asOfLive;
        return {
          source: 'snapshot',
          asOf,
          events: snap.data.events.map((ev) => ladderFromEvent(ev, asOf)),
          error,
          snapshotFile: snap.file,
        };
      }
      return { source: 'none', asOf: asOfLive, events: [], error };
    }
  }

  const snap = await loadPolymarketSnapshot();
  if (!snap?.data.events?.length) {
    return {
      source: 'none',
      asOf: asOfLive,
      events: [],
      error: snapshotOnly()
        ? 'SNAPSHOT_ONLY=true and no polymarket snapshot'
        : 'no polymarket data',
    };
  }
  const asOf = snap.data.capturedAt ?? asOfLive;
  return {
    source: 'snapshot',
    asOf,
    events: snap.data.events.map((ev) => ladderFromEvent(ev, asOf)),
    snapshotFile: snap.file,
  };
}
