/**
 * PreStocks API client (catalogue / metrics / stats).
 * Base: https://prestocks.com — do NOT call Tessera APIs.
 */

import { PRESTOCKS_API_BASE } from '@/config/universe';

export async function fetchPrestocksCatalogue(): Promise<unknown> {
  const res = await fetch(`${PRESTOCKS_API_BASE}/api/prestocks`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PreStocks /api/prestocks HTTP ${res.status}`);
  return res.json();
}

export async function fetchPrestocksMetrics(): Promise<unknown> {
  const res = await fetch(`${PRESTOCKS_API_BASE}/api/metrics`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PreStocks /api/metrics HTTP ${res.status}`);
  return res.json();
}

export async function fetchPrestocksStats(): Promise<unknown> {
  const res = await fetch(`${PRESTOCKS_API_BASE}/api/stats`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PreStocks /api/stats HTTP ${res.status}`);
  return res.json();
}
