/**
 * try-live-then-snapshot pattern.
 * Live fetch first; on failure / SNAPSHOT_ONLY=true, fall back to latest snapshot JSON.
 */

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { constants as fsConstants } from 'node:fs';

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
      .filter(
        (f) =>
          f.endsWith('.json') &&
          (f === 'latest.json' || f.startsWith('snapshot-')),
      )
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
  // Prefer explicit latest.json pointer when present
  const latestPath = path.join(snapshotDir(), 'latest.json');
  try {
    await access(latestPath, fsConstants.R_OK);
    const raw = await readFile(latestPath, 'utf8');
    return { file: 'latest.json', data: JSON.parse(raw) as T };
  } catch {
    // fall through to dated snapshots
  }

  const files = await listSnapshots();
  const dated = files.filter((f) => f.startsWith('snapshot-'));
  if (dated.length === 0) return null;
  const file = dated[0]!;
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
