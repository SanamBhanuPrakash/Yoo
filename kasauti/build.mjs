#!/usr/bin/env node
/**
 * Copies the engine into the extension.
 *
 * Chrome extensions cannot reference files above their own root, so the engine
 * is COPIED rather than symlinked or path-escaped. Deliberately a copy of the
 * same source files, never a fork: the extension and the CLI auditor must run
 * byte-identical detection logic, or a shopper and an auditor could look at the
 * same page and be told different things — at which point neither is evidence.
 *
 * Run: node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'engine');
const DEST = join(HERE, 'extension', 'engine');
mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const hashes = {};
for (const f of files) {
  const body = readFileSync(join(SRC, f));
  writeFileSync(join(DEST, f), body);
  hashes[f] = createHash('sha256').update(body).digest('hex').slice(0, 16);
  process.stdout.write(`  ${f.padEnd(16)} ${hashes[f]}\n`);
}

// Record the engine fingerprint so a report and an extension build can be shown
// to have used the same detection logic.
writeFileSync(join(HERE, 'extension', 'engine.lock.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), files: hashes }, null, 2));

process.stdout.write(`\ncopied ${files.length} engine file(s) into extension/engine/\n`);
