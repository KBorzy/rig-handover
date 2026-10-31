import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
};

export type NightCounts = {
  ok: number;
  retry: number;
  fail: number;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function nightCounts(runsDir: string): Record<string, NightCounts> {
  const out: Record<string, NightCounts> = {};
  for (const night of nightsOnDisk(runsDir)) {
    const digest = readNight(runsDir, night);
    if (!digest) continue;
    const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
    for (const row of digest.rows) {
      if (row.lastStatus === 'ok') counts.ok += 1;
      else if (row.lastStatus === 'retry') counts.retry += 1;
      else counts.fail += 1;
    }
    out[night] = counts;
  }
  return out;
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir),
  };
}
