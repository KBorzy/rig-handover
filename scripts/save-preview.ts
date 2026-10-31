/**
 * Save /digest/:night as one self-contained HTML file (ADR 0001).
 * Usage: pnpm exec tsx --env-file-if-exists=.env scripts/save-preview.ts [night] [out]
 */
import { writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const night = process.argv[2] ?? '2026-10-28';
const out = process.argv[3] ?? `preview-${night}.html`;

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (!res.ok) {
  console.error(`save-preview: ${res.status} for /digest/${night}`);
  process.exit(1);
}
const html = await res.text();
writeFileSync(out, html, 'utf8');
console.log(`wrote ${out} (${html.length} bytes)`);
