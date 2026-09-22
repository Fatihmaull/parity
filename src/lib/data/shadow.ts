/**
 * Shadow board — PreStocks mark prices for untokenized names.
 * GET /api/mark-price/batch?symbols=...
 * SNAPSHOT_ONLY / failure → src/data/snapshot/shadow/latest.json
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PRESTOCKS_API_BASE } from '@/config/universe';
import { SHADOW_CANDIDATES } from '@/config/shadow';
import { snapshotOnly } from '@/lib/data/liveOrSnapshot';

export interface ShadowMarkRow {
  symbol: string;
  markPrice: number;
}

export interface ShadowBundle {
  source: 'live' | 'snapshot' | 'none';
  asOf: string;
  rows: ShadowMarkRow[];
  skippedNulls: string[];
  error?: string;
  snapshotFile?: string;
}

interface ShadowSnapshot {
  capturedAt?: string;
  marks?: Record<string, number | null>;
}

async function fetchMarkBatch(
  symbols: readonly string[],
): Promise<Record<string, number | null>> {
  const url = `${PRESTOCKS_API_BASE}/api/mark-price/batch?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`PreStocks mark-price/batch HTTP ${res.status}`);
  }
  return (await res.json()) as Record<string, number | null>;
}

function rowsFromMarks(
  marks: Record<string, number | null>,
): { rows: ShadowMarkRow[]; skippedNulls: string[] } {
  const rows: ShadowMarkRow[] = [];
  const skippedNulls: string[] = [];
  for (const symbol of SHADOW_CANDIDATES) {
    const v = marks[symbol];
    if (typeof v === 'number' && Number.isFinite(v)) {
      rows.push({ symbol, markPrice: v });
    } else {
      skippedNulls.push(symbol);
    }
  }
  // Also surface any unexpected nulls asked for
  for (const [sym, v] of Object.entries(marks)) {
    if (
      !(SHADOW_CANDIDATES as readonly string[]).includes(sym) &&
      (v == null || !Number.isFinite(v))
    ) {
      if (!skippedNulls.includes(sym)) skippedNulls.push(sym);
    }
  }
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { rows, skippedNulls };
}

async function loadShadowSnapshot(): Promise<{
  file: string;
  data: ShadowSnapshot;
} | null> {
  const file = path.join(
    process.cwd(),
    'src/data/snapshot/shadow/latest.json',
  );
  try {
    const raw = await readFile(file, 'utf8');
    return { file: 'shadow/latest.json', data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export async function loadShadowBoard(): Promise<ShadowBundle> {
  const asOfLive = new Date().toISOString();

  if (!snapshotOnly()) {
    try {
      const marks = await fetchMarkBatch(SHADOW_CANDIDATES);
      const { rows, skippedNulls } = rowsFromMarks(marks);
      return { source: 'live', asOf: asOfLive, rows, skippedNulls };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const snap = await loadShadowSnapshot();
      if (snap?.data.marks) {
        const { rows, skippedNulls } = rowsFromMarks(snap.data.marks);
        return {
          source: 'snapshot',
          asOf: snap.data.capturedAt ?? asOfLive,
          rows,
          skippedNulls,
          error,
          snapshotFile: snap.file,
        };
      }
      return {
        source: 'none',
        asOf: asOfLive,
        rows: [],
        skippedNulls: [],
        error,
      };
    }
  }

  const snap = await loadShadowSnapshot();
  if (!snap?.data.marks) {
    return {
      source: 'none',
      asOf: asOfLive,
      rows: [],
      skippedNulls: [],
      error: snapshotOnly()
        ? 'SNAPSHOT_ONLY=true and no shadow snapshot'
        : 'no shadow data',
    };
  }
  const { rows, skippedNulls } = rowsFromMarks(snap.data.marks);
  return {
    source: 'snapshot',
    asOf: snap.data.capturedAt ?? asOfLive,
    rows,
    skippedNulls,
    snapshotFile: snap.file,
  };
}

/** Used by npm run snapshot to persist shadow marks. */
export async function captureShadowSnapshot(): Promise<ShadowSnapshot> {
  const marks = await fetchMarkBatch([
    ...SHADOW_CANDIDATES,
    'CEREBRAS', // document null skip
  ]);
  const payload: ShadowSnapshot = {
    capturedAt: new Date().toISOString(),
    marks,
  };
  const dir = path.join(process.cwd(), 'src/data/snapshot/shadow');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'latest.json'),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
  return payload;
}
