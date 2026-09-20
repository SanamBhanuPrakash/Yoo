#!/usr/bin/env node
/**
 * Runs every example claim and prints the verdict matrix.
 *
 * The point of the matrix is the third row. Every system in this space returns
 * "no earthquake" for both the Tokyo and the Timbuktu query. Only one of those
 * answers is honest.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '../src/engine/evaluate.js';

const dir = new URL('../examples/claims/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

const rows = [];
for (const f of files) {
  const claim = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  process.stderr.write(`evaluating ${f}\n`);
  const r = await evaluate(claim);
  rows.push({
    example: f.replace('.json', ''),
    verdict: r.verdict.verdict,
    provenance: r.verdict.derivation,
    observability: r.observabilityIndex.index,
    sources: r.findings.map((x) => `${x.sourceId}:${x.status}`).join(' '),
  });
}

const w = (s, n) => String(s).padEnd(n);
process.stdout.write(`\n${w('EXAMPLE', 26)}${w('VERDICT', 16)}${w('PROVENANCE', 12)}${w('OBS', 7)}SOURCES\n`);
process.stdout.write('-'.repeat(118) + '\n');
for (const r of rows) {
  process.stdout.write(
    `${w(r.example, 26)}${w(r.verdict, 16)}${w(r.provenance, 12)}${w(r.observability, 7)}${r.sources}\n`);
}
process.stdout.write(
  '\nNote: every other system in this space returns "no earthquake" for BOTH seismic rows.\n' +
  'Only the Tokyo one is a defensible negative. The Timbuktu claim sits below the\n' +
  'catalogue’s completeness threshold for that region, so its silence means nothing.\n');
