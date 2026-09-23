/**
 * PreStocks API client (catalogue / metrics / stats).
 * Base: https://prestocks.com — do NOT call Tessera APIs.
 *
 * Soft-fail + short Next.js revalidate to avoid cascading 429 → full snapshot stale.
 */

import { PRESTOCKS_API_BASE } from '@/config/universe';

/** Next Data Cache TTL (seconds). Also keeps Vercel from hammering PreStocks. */
const REVALIDATE_SEC = 120;

/** Initial attempt + this many retries on 429 / 5xx / network errors. */
const MAX_RETRIES = 2;

export interface PrestocksOk<T = unknown> {
  ok: true;
  data: T;
  status: number;
}

export interface PrestocksFail {
  ok: false;
  error: string;
  status: number;
}

export type PrestocksResult<T = unknown> = PrestocksOk<T> | PrestocksFail;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Fetch with Next revalidate cache, exponential backoff on 429/5xx/network.
 * Never throws — returns typed soft-fail.
 */
async function fetchPrestocks(
  path: string,
  label: string,
): Promise<PrestocksResult> {
  const url = `${PRESTOCKS_API_BASE}${path}`;
  let lastStatus = 0;
  let lastError = `PreStocks ${label} failed`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // 250ms, 500ms
      await sleep(250 * 2 ** (attempt - 1));
    }
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: REVALIDATE_SEC },
      });
      if (res.ok) {
        const data: unknown = await res.json();
        return { ok: true, data, status: res.status };
      }
      lastStatus = res.status;
      lastError = `PreStocks ${label} HTTP ${res.status}`;
      if (!isRetryableStatus(res.status)) {
        return { ok: false, error: lastError, status: res.status };
      }
    } catch (e) {
      lastStatus = 0;
      lastError =
        e instanceof Error
          ? `PreStocks ${label}: ${e.message}`
          : `PreStocks ${label}: ${String(e)}`;
      // network errors are retryable
    }
  }

  return { ok: false, error: lastError, status: lastStatus };
}

export async function fetchPrestocksCatalogue(): Promise<PrestocksResult> {
  return fetchPrestocks('/api/prestocks', '/api/prestocks');
}

export async function fetchPrestocksMetrics(): Promise<PrestocksResult> {
  return fetchPrestocks('/api/metrics', '/api/metrics');
}

export async function fetchPrestocksStats(): Promise<PrestocksResult> {
  return fetchPrestocks('/api/stats', '/api/stats');
}

/** Throw on soft-fail — for callers (e.g. snapshot) that prefer exceptions. */
export async function fetchPrestocksCatalogueOrThrow(): Promise<unknown> {
  const r = await fetchPrestocksCatalogue();
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export async function fetchPrestocksMetricsOrThrow(): Promise<unknown> {
  const r = await fetchPrestocksMetrics();
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export async function fetchPrestocksStatsOrThrow(): Promise<unknown> {
  const r = await fetchPrestocksStats();
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
