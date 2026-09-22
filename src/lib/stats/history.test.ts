import { describe, it, expect } from 'vitest';
import {
  cumulativeVolumeSeries,
  dailyVolumeSeries,
  holdersSeries,
  downsample,
} from './history';
import type { PrestocksStatsPayload } from '@/lib/domain';

const stats: PrestocksStatsPayload = {
  volume: [
    { date: '2026-01-01', SPACEX: 100, OPENAI: 50 },
    { date: '2026-01-02', SPACEX: 150, OPENAI: 80 },
    { date: '2026-01-03', SPACEX: 140, OPENAI: 100 }, // SPACEX dip
  ],
  holders: [
    { week: '2026-01-01', SPACEX: 10, OPENAI: 20 },
    { week: '2026-01-08', SPACEX: 12, OPENAI: 25 },
  ],
};

describe('stats history series', () => {
  it('keeps cumulative volume as-is', () => {
    const c = cumulativeVolumeSeries(stats, ['SPACEX', 'OPENAI']);
    expect(c).toHaveLength(3);
    expect(c[1]).toMatchObject({ t: '2026-01-02', SPACEX: 150, OPENAI: 80 });
  });

  it('differences cumulative → daily (floors negatives)', () => {
    const d = dailyVolumeSeries(stats, ['SPACEX', 'OPENAI']);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ t: '2026-01-02', SPACEX: 50, OPENAI: 30 });
    // dip 140-150 = -10 → floored to 0
    expect(d[1]).toMatchObject({ t: '2026-01-03', SPACEX: 0, OPENAI: 20 });
  });

  it('can keep negative deltas when floorAtZero=false', () => {
    const d = dailyVolumeSeries(stats, ['SPACEX'], { floorAtZero: false });
    expect(d[1]?.SPACEX).toBe(-10);
  });

  it('maps weekly holders from stats only', () => {
    const h = holdersSeries(stats, ['SPACEX', 'OPENAI']);
    expect(h).toEqual([
      { t: '2026-01-01', SPACEX: 10, OPENAI: 20 },
      { t: '2026-01-08', SPACEX: 12, OPENAI: 25 },
    ]);
  });

  it('downsamples preserving last point', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      t: `2026-01-${String(i + 1).padStart(2, '0')}`,
      SPACEX: i,
    }));
    const d = downsample(rows, 3);
    expect(d.length).toBeLessThanOrEqual(4);
    expect(d[d.length - 1]?.t).toBe('2026-01-10');
  });
});
