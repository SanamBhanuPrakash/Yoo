#!/usr/bin/env node
/**
 * Kasauti CLI auditor.
 *
 * The extension tells a shopper what is happening on the page in front of
 * them. This tells a journalist, a consumer body, a regulator or a platform's
 * own compliance team what is happening on a site — reproducibly, with
 * evidence, from a command line.
 *
 * IT DOES ONE THING NO IN-PAGE SCAN CAN: THE COUNTDOWN RELOAD TEST.
 *
 * A countdown next to an offer is, on its own, only suspicious. It becomes a
 * matter of fact when you load the page, wait, reload, and the timer restarts
 * at the same value. Real time passed. A real deadline would have moved. One
 * that did not was never counting down to anything.
 *
 * That turns the most common dark pattern in Indian e-commerce from an
 * accusation into an observation, which is the difference between a complaint
 * and a filing.
 *
 * Usage:
 *   node cli/audit.mjs <url> [--out DIR] [--nag-seconds N] [--no-proof] [--headed]
 */

import { probeDismissibility, probeOptOutPersistence, probeCancellationAsymmetry } from './probes.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const ENGINE_FILES = ['registry.js', 'lexicon.js', 'measure.js', 'detectors.js', 'score.js', 'scan.js'];

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

if (!url) {
  process.stderr.write(
    'usage: node cli/audit.mjs <url> [options]\n\n' +
    '  --out DIR         where to write the report (default: out)\n' +
    '  --nag-seconds N   observation window for nagging (default: 8, 0 to skip)\n' +
    '  --no-proof        skip the countdown reload test\n' +
    '  --no-probe        skip the interaction probes\n' +
    '  --crawl           also measure join/leave asymmetry across the site\n' +
    '  --headed          run with a visible browser\n');
  process.exit(2);
}

/** Parse mm:ss or hh:mm:ss into seconds. Returns null for anything else. */
function toSeconds(v) {
  const parts = String(v).split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

async function injectEngine(page) {
  for (const f of ENGINE_FILES) await page.addScriptTag({ path: join(ENGINE, f) });
}

async function loadAndScan(browser, target) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  // Give client-rendered storefronts a moment; almost all Indian e-commerce is SPA.
  await page.waitForTimeout(2500);
  await injectEngine(page);
  const report = await page.evaluate(() => globalThis.Kasauti.scan());
  return { page, report, status: response ? response.status() : null };
}

/**
 * The proof. Two loads separated by real time; a genuine deadline must shrink.
 */
async function countdownReloadTest(browser, target, firstReport) {
  const timerFinding = firstReport.findings.find((f) => f.rule === 'countdown-present');
  if (!timerFinding) {
    return { ran: false, reason: 'no countdown timer was present on the first load' };
  }

  const before = timerFinding.evidence.timers;
  const WAIT_MS = 6000;
  process.stderr.write(`  • countdown proof: waiting ${WAIT_MS / 1000}s, then reloading…\n`);
  await new Promise((r) => setTimeout(r, WAIT_MS));

  const { page, report } = await loadAndScan(browser, target);
  await page.close();
  const afterFinding = report.findings.find((f) => f.rule === 'countdown-present');
  const after = afterFinding ? afterFinding.evidence.timers : [];

  const comparisons = [];
  for (const b of before) {
    const a = after.find((x) => x.selector === b.selector);
    if (!a) {
      comparisons.push({ selector: b.selector, verdict: 'DISAPPEARED', before: b.value });
      continue;
    }
    const bs = toSeconds(b.value);
    const as = toSeconds(a.value);
    if (bs === null || as === null) {
      comparisons.push({ selector: b.selector, verdict: 'UNPARSEABLE', before: b.value, after: a.value });
      continue;
    }
    const elapsed = Math.round(WAIT_MS / 1000);
    // A real deadline loses at least the time that passed (allowing slack for
    // page-load latency and rounding).
    const expectedMax = bs - elapsed + 3;
    const verdict = as > expectedMax ? 'FABRICATED' : 'CONSISTENT';
    comparisons.push({
      selector: b.selector, verdict,
      before: b.value, after: a.value,
      beforeSeconds: bs, afterSeconds: as,
      secondsElapsedBetweenLoads: elapsed,
      expectedAtMostSeconds: Math.max(0, expectedMax),
      reasoning: verdict === 'FABRICATED'
        ? `${elapsed}s of real time passed between loads, so a genuine deadline would read at ` +
          `most ${Math.max(0, expectedMax)}s. It read ${as}s, meaning the timer restarted ` +
          'rather than counted down. The urgency is fabricated.'
        : `The timer fell as real time passed, consistent with a genuine deadline.`,
    });
  }

  const fabricated = comparisons.filter((c) => c.verdict === 'FABRICATED');
  return {
    ran: true,
    waitMs: WAIT_MS,
    comparisons,
    proven: fabricated.length > 0,
    finding: fabricated.length > 0
      ? {
          pattern: 'FALSE_URGENCY',
          confidence: 'PROVEN',
          rule: 'countdown-resets-on-reload',
          summary: `${fabricated.length} countdown timer(s) restarted at the same value after a ` +
            `page reload ${Math.round(WAIT_MS / 1000)} seconds later. The deadline is not real.`,
          evidence: {
            comparisons: fabricated,
            method: 'Two page loads separated by measured wall-clock time. A genuine deadline ' +
                    'must decrease by at least the elapsed interval. One that does not has ' +
                    'been reset by the page, which is false urgency as a matter of fact ' +
                    'rather than of interpretation.',
          },
        }
      : null,
  };
}

async function main() {
  const outDir = flag('out', 'out');
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: !has('headed'),
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  process.stderr.write(`• auditing ${url}\n`);
  const { page, report, status } = await loadAndScan(browser, url);
  process.stderr.write(`  • loaded (HTTP ${status}) — ${report.findings.length} finding(s)\n`);

  // Nagging needs time, so it is observed rather than snapshotted.
  const nagSeconds = Number(flag('nag-seconds', '8'));
  let nagging = { supported: false, interruptions: [] };
  if (nagSeconds > 0) {
    process.stderr.write(`  • observing for nagging (${nagSeconds}s)…\n`);
    nagging = await page.evaluate(
      (ms) => globalThis.Kasauti.observeNagging(ms), nagSeconds * 1000);
    if (nagging.finding) report.findings.push(nagging.finding);

    // The scan marks NAGGING unchecked because a snapshot cannot see repetition.
    // The CLI just watched for it, so the report must say so rather than leaving
    // a checked pattern sitting in the "not checked" list.
    report.notChecked = report.notChecked.filter((n) => n.pattern !== 'NAGGING');
    if (!nagging.finding) {
      report.notDetected.push({
        pattern: 'NAGGING',
        legalName: 'Nagging',
        clause: 'Annexure 1(10)',
        detectability: 'REQUIRES_FLOW',
        caveat: `Observed for ${nagSeconds}s of idle browsing; no repeated interruptions ` +
          'appeared. A longer session, or one involving scrolling and exit intent, may ' +
          'surface interruptions this window did not.',
      });
    }
  }

  // ---- Active probes: stop observing the page, start testing it --------
  // Observation says "no visible dismiss control". A probe says "Escape, a
  // backdrop click and every close-looking control were tried and it is still
  // there". Only the second survives "the user could just press Escape".
  const probes = {};
  if (!has('no-probe')) {
    const forced = report.findings.find((f) => f.pattern === 'FORCED_ACTION');
    if (forced) {
      process.stderr.write('  \u2022 probing overlay dismissibility\u2026\n');
      probes.dismissibility = await probeDismissibility(page, forced);
      if (probes.dismissibility.finding) {
        // The probe supersedes the passive finding rather than sitting beside it.
        report.findings = report.findings.filter((f) => f !== forced);
        report.findings.push(probes.dismissibility.finding);
      }
    }
    if (report.findings.some((f) => f.pattern === 'BASKET_SNEAKING')) {
      process.stderr.write('  \u2022 probing whether opting out sticks\u2026\n');
      probes.optOut = await probeOptOutPersistence(page, url);
      if (probes.optOut.finding) report.findings.push(probes.optOut.finding);
    }
  }

  const screenshot = join(outDir, `${slug(url)}.png`);
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  await page.close();

  // SUBSCRIPTION_TRAP is declared unassessable by the page scan, and strictly
  // still is. This measures the gradient between joining and leaving, which is
  // a different and weaker claim -- and says so in those words.
  if (has('crawl')) {
    process.stderr.write('  \u2022 measuring join/leave asymmetry\u2026\n');
    try {
      probes.cancellation = await probeCancellationAsymmetry(browser, new URL(url).origin);
      if (probes.cancellation.finding) {
        report.findings.push(probes.cancellation.finding);
        report.notChecked = report.notChecked.filter((n) => n.pattern !== 'SUBSCRIPTION_TRAP');
      }
    } catch (err) {
      probes.cancellation = { ran: false, reason: err.message };
    }
  }

  let proof = { ran: false, reason: 'skipped (--no-proof)' };
  if (!has('no-proof')) proof = await countdownReloadTest(browser, url, report);
  if (proof.finding) report.findings.push(proof.finding);

  await browser.close();

  // Re-sort and re-summarise now that time-based findings have joined.
  const rank = { PROVEN: 3, STRONG: 2, INDICATIVE: 1 };
  report.findings.sort((a, b) => (rank[b.confidence] || 0) - (rank[a.confidence] || 0));
  report.summary.findingCount = report.findings.length;
  report.summary.proven = report.findings.filter((f) => f.confidence === 'PROVEN').length;
  report.summary.strong = report.findings.filter((f) => f.confidence === 'STRONG').length;
  report.summary.indicative = report.findings.filter((f) => f.confidence === 'INDICATIVE').length;
  report.summary.byPattern = report.findings.reduce((acc, f) => {
    acc[f.pattern] = (acc[f.pattern] || 0) + 1; return acc;
  }, {});
  report.summary.patternsDetected = Object.keys(report.summary.byPattern).length;
  report.notDetected = report.notDetected.filter((n) => !report.summary.byPattern[n.pattern]);

  // The Compliance Index is computed LAST, over the findings as they finally
  // stand -- including the ones the probes upgraded from STRONG to PROVEN.
  report.score = await computeScore(report);

  report.audit = {
    tool: 'Kasauti',
    version: '0.2.0',
    httpStatus: status,
    screenshot,
    naggingObservation: { seconds: nagSeconds, interruptions: nagging.interruptions ?? [] },
    countdownProof: proof,
    probes,
    auditedAt: new Date().toISOString(),
  };
  // Fingerprint over the findings so two parties can confirm they hold the
  // same audit without re-running it.
  report.audit.reportDigest = 'sha256:' + createHash('sha256')
    .update(JSON.stringify({ url: report.url, findings: report.findings })).digest('hex');

  const jsonPath = join(outDir, `${slug(url)}.audit.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const { renderAuditReport } = await import('./report.mjs');
  const htmlPath = join(outDir, `${slug(url)}.audit.html`);
  writeFileSync(htmlPath, renderAuditReport(report));

  print(report, jsonPath, htmlPath);
}

/**
 * Scoring lives in the engine so the extension and the CLI cannot drift apart.
 * Running it in a page context rather than porting it to Node is deliberate:
 * a second implementation is a second set of bugs and a second set of numbers.
 */
async function computeScore(report) {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.goto('about:blank');
  for (const f of ['registry.js', 'score.js']) await pg.addScriptTag({ path: join(ENGINE, f) });
  const s = await pg.evaluate((r) => globalThis.Kasauti.score(r),
    { findings: report.findings, notChecked: report.notChecked });
  await b.close();
  return s;
}

function print(report, jsonPath, htmlPath) {
  const s = report.summary;
  const sc = report.score;
  if (sc) {
    process.stdout.write(
      `\n  COMPLIANCE INDEX  ${sc.value}/100  grade ${sc.grade}` +
      `   \u00b7   assurance ${sc.assurance}%  (${sc.patternsAssessed}/${sc.patternsTotal} patterns assessed)\n`);
    process.stdout.write(`  ${sc.label}\n`);
  }
  process.stdout.write(`\n${report.title ?? report.url}\n`);
  process.stdout.write(`${'─'.repeat(64)}\n`);
  process.stdout.write(
    `${s.findingCount} finding(s) across ${s.patternsDetected} of the 13 CCPA patterns  ` +
    `(${s.proven} proven, ${s.strong} strong, ${s.indicative} indicative)\n\n`);
  for (const f of report.findings) {
    process.stdout.write(`  [${f.confidence.padEnd(10)}] ${f.pattern}\n      ${f.summary}\n`);
  }
  process.stdout.write(
    `\n  Not checked (${report.notChecked.length}): ` +
    report.notChecked.map((n) => n.pattern).join(', ') + '\n');
  process.stdout.write(`\n  report ${htmlPath}\n  data   ${jsonPath}\n`);
}

function slug(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '').slice(0, 70);
}

main().catch((err) => { process.stderr.write(`FAILED: ${err.message}\n`); process.exit(1); });
