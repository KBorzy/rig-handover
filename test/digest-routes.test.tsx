import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/types.js';

function appWithRuns(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe('digest routes', () => {
  it('GET /digest/2026-10-28 renders the night', async () => {
    const res = await appWithRuns('runs').request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('notes/backup');
    expect(html).toContain('—'); // null owner
  });

  it('GET /api/digest/:night matches the page jobs and order', async () => {
    const app = appWithRuns('runs');
    const page = await (await app.request('/digest/2026-10-28')).text();
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as Array<{ job: string }>;
    const digest = readNight('runs', '2026-10-28')!;
    expect(json.map((r) => r.job)).toEqual(digest.rows.map((r) => r.job));
    for (const job of digest.rows.map((r) => r.job)) {
      expect(page.indexOf(job)).toBeGreaterThan(-1);
    }
    // same order in the HTML table body as in JSON
    let cursor = 0;
    for (const job of json.map((r) => r.job)) {
      const next = page.indexOf(job, cursor);
      expect(next).toBeGreaterThan(-1);
      cursor = next + job.length;
    }
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const app = appWithRuns(dir);
    expect((await app.request('/digest/2099-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/2099-01-01')).status).toBe(404);
  });

  it('empty night file renders nothing ran', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-10-01.jsonl'), '');
    const res = await appWithRuns(dir).request('/digest/2026-10-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
    expect(await (await appWithRuns(dir).request('/api/digest/2026-10-01')).json()).toEqual([]);
  });

  it('a night with a bad line still renders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-10-02.jsonl'),
      [
        '{"at":"2026-10-02T01:00:00+01:00","job":"a/job","status":"ok","owner":"x"}',
        'not-json',
        '',
      ].join('\n'),
    );
    const res = await appWithRuns(dir).request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('a/job');
  });
});

describe('board links', () => {
  it('links both nights on disk to a digest that renders', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const app = appWithRuns('runs');
    const board = await (await app.request('/')).text();
    expect(board).toContain('href="/digest/2026-10-28"');
    expect(board).toContain('href="/digest/2026-10-27"');
    expect(board).toMatch(/ok · .* retry · .* fail/);

    for (const night of ['2026-10-28', '2026-10-27']) {
      const res = await app.request(`/digest/${night}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`digest · ${night}`);
    }
  });
});
