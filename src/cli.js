#!/usr/bin/env node
/**
 * Sakshya CLI.
 *
 *   sakshya attest <claim.json> [--out DIR] [--key FILE] [--use USE]
 *   sakshya verify <bundle.json> [--reproduce]
 *   sakshya keygen [--out DIR]
 *   sakshya screen  [--use USE]        list every source and what it permits
 *
 * @module cli
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { evaluate } from './engine/evaluate.js';
import { buildBundle } from './attest/bundle.js';
import { generateIssuerKeypair, signBundle } from './attest/sign.js';
import { verifyBundle } from './attest/verify.js';
import { renderCertificate } from './render/certificate.js';
import { ADAPTERS } from './sources/index.js';
import { screenSource } from './license/policy.js';
import { USE } from './license/registry.js';

const ENGINE_VERSION = '0.1.0';

function flag(argv, name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}
const has = (argv, name) => argv.includes(`--${name}`);

async function cmdAttest(argv) {
  const file = argv[0];
  if (!file) die('usage: sakshya attest <claim.json> [--out DIR] [--key FILE] [--use USE]');
  const claim = JSON.parse(readFileSync(file, 'utf8'));
  const use = flag(argv, 'use');
  if (use) claim.intendedUse = use;

  process.stderr.write(`• evaluating: ${claim.statement ?? basename(file)}\n`);
  const evaluation = await evaluate(claim);

  for (const f of evaluation.findings) {
    process.stderr.write(
      `  – ${pad(f.sourceId, 22)} ${pad(f.status, 14)} OI ${String(f.observability.index).padEnd(6)} ` +
      `${f.queried ? `HTTP ${f.httpStatus ?? '-'}` : 'not queried'}\n`);
  }

  let bundle = buildBundle(evaluation, { engineVersion: ENGINE_VERSION, operator: flag(argv, 'operator') });

  const keyFile = flag(argv, 'key');
  if (keyFile && existsSync(keyFile)) {
    bundle = signBundle(bundle, readFileSync(keyFile, 'utf8'), { issuer: flag(argv, 'issuer') });
    process.stderr.write('  – signed (ed25519)\n');
  }

  const outDir = flag(argv, 'out', 'out');
  mkdirSync(outDir, { recursive: true });
  const stem = basename(file).replace(/\.json$/, '');
  const jsonPath = join(outDir, `${stem}.bundle.json`);
  const htmlPath = join(outDir, `${stem}.certificate.html`);
  writeFileSync(jsonPath, JSON.stringify(bundle, null, 2));
  writeFileSync(htmlPath, renderCertificate(bundle));

  const v = evaluation.verdict;
  process.stdout.write(
    `\n${v.verdict}  (${v.derivation}, confidence ${v.confidence}, observability ${evaluation.observabilityIndex.index})\n` +
    `${v.headline}\n${v.reason}\n\n  bundle      ${jsonPath}\n  certificate ${htmlPath}\n`);
}

async function cmdVerify(argv) {
  const file = argv[0];
  if (!file) die('usage: sakshya verify <bundle.json> [--reproduce]');
  const bundle = JSON.parse(readFileSync(file, 'utf8'));
  const result = await verifyBundle(bundle, { reproduce: has(argv, 'reproduce') });
  for (const c of result.checks) {
    process.stdout.write(`${c.passed ? 'PASS' : 'FAIL'}  ${pad(c.check, 16)} ${c.detail}\n`);
  }
  for (const r of result.reproductions) {
    process.stdout.write(`      ${pad(r.sourceId, 22)} ${r.outcome}${r.detail ? ` — ${r.detail}` : ''}\n`);
  }
  process.stdout.write(`\n${result.summary}\n`);
  if (!result.valid) process.exitCode = 1;
}

function cmdKeygen(argv) {
  const outDir = flag(argv, 'out', '.');
  mkdirSync(outDir, { recursive: true });
  const { privateKeyPem, publicKeyPem } = generateIssuerKeypair();
  writeFileSync(join(outDir, 'issuer.key.pem'), privateKeyPem, { mode: 0o600 });
  writeFileSync(join(outDir, 'issuer.pub.pem'), publicKeyPem);
  process.stdout.write(`issuer keypair written to ${outDir}/issuer.key.pem (keep private) and issuer.pub.pem\n`);
}

function cmdScreen(argv) {
  const use = flag(argv, 'use', USE.COMMERCIAL_REDISTRIBUTION);
  process.stdout.write(`Screening every registered adapter for: ${use}\n\n`);
  for (const a of ADAPTERS) {
    const s = screenSource(a.id, use);
    process.stdout.write(
      `${s.allowed ? 'ALLOW' : 'BLOCK'}  ${pad(a.id, 24)} ${pad(s.license, 26)} ${a.derivation}\n` +
      `       ${s.reason}\n\n`);
  }
}

function pad(s, n) { return String(s ?? '').padEnd(n); }
function die(msg) { process.stderr.write(`${msg}\n`); process.exit(2); }

const [cmd, ...rest] = process.argv.slice(2);
const table = { attest: cmdAttest, verify: cmdVerify, keygen: cmdKeygen, screen: cmdScreen };
if (!table[cmd]) {
  die('sakshya <attest|verify|keygen|screen> [...]\n\n' +
      '  attest <claim.json> [--out DIR] [--key FILE] [--use USE]  evaluate a claim and issue a bundle\n' +
      '  verify <bundle.json> [--reproduce]                        check integrity, and optionally re-fetch\n' +
      '  keygen [--out DIR]                                        create an ed25519 issuer keypair\n' +
      '  screen [--use USE]                                        show what each source permits\n');
}
await table[cmd](rest);
