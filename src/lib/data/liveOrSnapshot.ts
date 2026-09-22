/**
 * try-live-then-snapshot pattern stubs.
 * Live fetch first; on failure / SNAPSHOT_ONLY=true, fall back to latest snapshot JSON.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export function snapshotOnly(): boolean {
  return process.env.SNAPSHOT_ONLY === 'true';
}

export function snapshotDir(): string {
  return path.join(process.cwd(), 'src/data/snapshot');
}

export async function listSnapshots(): Promise<string[]> {
  try {
    const files = await readdir(snapshotDir());
    return files
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function loadLatestSnapshot<T = unknown>(): Promise<{
  file: string;
  data: T;
} | null> {
  const files = await listSnapshots();
  if (files.length === 0) return null;
  const file = files[0]!;
  const raw = await readFile(path.join(snapshotDir(), file), 'utf8');
  return { file, data: JSON.parse(raw) as T };
}

/**
 * Try live fetcher; if SNAPSHOT_ONLY or live throws/returns null, use snapshot.
 */
export async function tryLiveThenSnapshot<TLive, TSnap = unknown>(opts: {
  live: () => Promise<TLive | null>;
  fromSnapshot: (snap: TSnap, file: string) => TLive | null;
}): Promise<{
  source: 'live' | 'snapshot' | 'none';
  data: TLive | null;
  snapshotFile?: string;
  error?: string;
}> {
  if (!snapshotOnly()) {
    try {
      const data = await opts.live();
      if (data != null) {
        return { source: 'live', data };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const snap = await loadLatestSnapshot<TSnap>();
      if (snap) {
        const data = opts.fromSnapshot(snap.data, snap.file);
        return {
          source: data != null ? 'snapshot' : 'none',
          data,
          snapshotFile: snap.file,
          error,
        };
      }
      return { source: 'none', data: null, error };
    }
  }

  const snap = await loadLatestSnapshot<TSnap>();
  if (!snap) {
    return {
      source: 'none',
      data: null,
      error: snapshotOnly()
        ? 'SNAPSHOT_ONLY=true and no snapshot files'
        : 'live returned null and no snapshot',
    };
  }
  const data = opts.fromSnapshot(snap.data, snap.file);
  return {
    source: data != null ? 'snapshot' : 'none',
    data,
    snapshotFile: snap.file,
  };
}
