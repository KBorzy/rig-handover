import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

function isJobStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(raw: string): LogLine | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.at !== 'string') return null;
  if (typeof obj.job !== 'string') return null;
  if (!isJobStatus(obj.status)) return null;
  if (!(obj.owner === null || typeof obj.owner === 'string')) return null;
  if (obj.error !== undefined && typeof obj.error !== 'string') return null;
  return {
    at: obj.at,
    job: obj.job,
    status: obj.status,
    owner: obj.owner,
    error: typeof obj.error === 'string' ? obj.error : undefined,
  };
}

/**
 * Read `runs/<night>.jsonl` into one row per job.
 * Missing file → null. A line that doesn't parse is counted, never thrown.
 */
export function readNight(runsDir: string, night: string): NightDigest | null {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const text = readFileSync(path, 'utf8');
  const lines = text.length === 0 ? [] : text.split(/\r?\n/);
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (!entry) {
      badLines += 1;
      continue;
    }

    const existing = byJob.get(entry.job);
    if (!existing) {
      byJob.set(entry.job, {
        job: entry.job,
        owner: entry.owner,
        runs: 1,
        retries: entry.status === 'retry' ? 1 : 0,
        lastStatus: entry.status,
        lastError: entry.error ?? null,
        firstAt: entry.at,
        lastAt: entry.at,
      });
      continue;
    }

    existing.runs += 1;
    if (entry.status === 'retry') existing.retries += 1;
    existing.owner = entry.owner;
    existing.lastStatus = entry.status;
    existing.lastError = entry.error ?? null;
    existing.lastAt = entry.at;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines };
}
