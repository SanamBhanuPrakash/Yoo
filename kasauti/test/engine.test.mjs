/**
 * Kasauti engine tests.
 *
 * Run inside a REAL Chromium, not a DOM simulator. That is not a convenience:
 * half these detectors depend on computed styles, rendered geometry and WCAG
 * contrast against a composited background. A simulated DOM would let the
 * suite pass while the product failed on the only thing it claims to do.
 *
 * The clean-page suite matters more than the dirty-page suite. Any regex can
 * find a violation on a page built to contain one. A tool that also stays
 * quiet on an honestly-built page is the difference between an instrument and
 * a noise generator — and the false-positive rate is what gets an audit tool
 * thrown out of a compliance meeting.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const FIXTURES = join(HERE, 'fixtures');

let browser;
let dirty;
let clean;

async function scanFixture(name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`file://${join(FIXTURES, name)}`);
  for (const f of ['registry.js', 'measure.js', 'detectors.js', 'scan.js']) {
    await page.addScriptTag({ path: join(ENGINE, f) });
  }
  const report = await page.evaluate(() => globalThis.Kasauti.scan());
  await page.close();
  return report;
}

before(async () => {
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  dirty = await scanFixture('dirty.html');
  clean = await scanFixture('clean.html');
});

after(async () => { if (browser) await browser.close(); });

const has = (report, pattern) => report.findings.some((f) => f.pattern === pattern);
const get = (report, pattern) => report.findings.filter((f) => f.pattern === pattern);

/* ===================================================================== *
 * THE CLEAN PAGE. Nothing may fire here.
 * ===================================================================== */

test('CLEAN PAGE: no findings at all on an honestly built checkout', () => {
  assert.deepEqual(
    clean.findings.map((f) => `${f.pattern}:${f.rule}`),
    [],
    'a false positive on an honest page is the failure that discredits the whole tool',
  );
});

test('CLEAN PAGE: unticked paid add-ons are NOT basket sneaking', () => {
  // Same three priced add-ons as the dirty page, simply not pre-selected.
  assert.equal(has(clean, 'BASKET_SNEAKING'), false);
});

test('CLEAN PAGE: comparable accept/decline buttons are NOT interference', () => {
  assert.equal(has(clean, 'INTERFACE_INTERFERENCE'), false);
});

test('CLEAN PAGE: a plainly worded "No thanks" is NOT confirm shaming', () => {
  assert.equal(has(clean, 'CONFIRM_SHAMING'), false);
});

test('CLEAN PAGE: a legible "Sponsored" label is NOT a disguised advertisement', () => {
  assert.equal(has(clean, 'DISGUISED_ADVERTISEMENT'), false);
});

test('CLEAN PAGE: single-polarity consent wording is NOT a trick question', () => {
  assert.equal(has(clean, 'TRICK_QUESTION'), false);
});

test('CLEAN PAGE: a stated in-stock fact and a real expiry date are NOT false urgency', () => {
  assert.equal(has(clean, 'FALSE_URGENCY'), false);
});

test('CLEAN PAGE: an all-inclusive total is NOT drip pricing', () => {
  assert.equal(has(clean, 'DRIP_PRICING'), false);
});

/* ===================================================================== *
 * THE DIRTY PAGE. Each pattern must be caught, with usable evidence.
 * ===================================================================== */

test('BASKET_SNEAKING: every pre-ticked paid add-on is caught', () => {
  const f = get(dirty, 'BASKET_SNEAKING');
  assert.equal(f.length, 3, 'insurance, donation and express delivery');
  assert.ok(f.every((x) => x.evidence.checkedByDefault === true));
  assert.ok(f.some((x) => x.evidence.carriesPrice === true));
  assert.ok(f.some((x) => x.confidence === 'PROVEN'));
});

test('BASKET_SNEAKING: an unticked marketing opt-in is correctly left alone', () => {
  const labels = get(dirty, 'BASKET_SNEAKING').map((f) => f.evidence.label);
  assert.ok(!labels.some((l) => /occasional offers/i.test(l)),
    'an unticked box is a genuine choice and must not be flagged');
});

test('INTERFACE_INTERFERENCE: the asymmetry is reported as measured numbers', () => {
  const f = get(dirty, 'INTERFACE_INTERFERENCE')[0];
  assert.ok(f, 'the membership upsell must be caught');
  assert.ok(f.evidence.areaRatio >= 3, `area ratio was ${f.evidence.areaRatio}`);
  assert.ok(f.evidence.declineContrastRatio < 4.5,
    `decline contrast ${f.evidence.declineContrastRatio} should be below the WCAG AA floor`);
  assert.equal(f.confidence, 'PROVEN');
  assert.match(f.summary, /\d+(\.\d+)?×/, 'the summary must quote the ratio, not adjectives');
});

test('CONFIRM_SHAMING: the decline wording is quoted verbatim as evidence', () => {
  const f = get(dirty, 'CONFIRM_SHAMING')[0];
  assert.ok(f);
  assert.match(f.evidence.declineText, /don't care about saving money/i);
});

test('FORCED_ACTION: the inescapable wall is PROVEN, with coverage and scroll lock', () => {
  const f = get(dirty, 'FORCED_ACTION')[0];
  assert.ok(f, 'the sign-in wall must be caught');
  assert.equal(f.evidence.scrollLocked, true);
  assert.equal(f.evidence.dismissControlsFound, 0);
  assert.ok(f.evidence.viewportCoverage > 0.9);
  assert.equal(f.confidence, 'PROVEN');
});

test('FALSE_URGENCY: scarcity claims are caught but NOT called proven violations', () => {
  const f = get(dirty, 'FALSE_URGENCY');
  assert.ok(f.length >= 2);
  assert.ok(f.every((x) => x.confidence === 'INDICATIVE'),
    'we cannot see the seller inventory, so we must not claim the scarcity is false');
  assert.ok(f.some((x) => /substantiation/.test(x.evidence.note ?? '')));
});

test('FALSE_URGENCY: the countdown is recorded with its value for the reload test', () => {
  const timer = get(dirty, 'FALSE_URGENCY').find((f) => f.rule === 'countdown-present');
  assert.ok(timer, 'the countdown must be captured');
  assert.match(timer.evidence.timers[0].value, /^\d{1,2}:\d{2}(:\d{2})?$/);
});

test('TRICK_QUESTION: stacked negations are counted and the label quoted', () => {
  const f = get(dirty, 'TRICK_QUESTION')[0];
  assert.ok(f);
  assert.ok(f.evidence.negationCount >= 3, `counted ${f.evidence.negationCount}`);
  assert.match(f.evidence.label, /untick/i);
});

test('DISGUISED_ADVERTISEMENT: the illegible disclosure is measured, not judged', () => {
  const f = get(dirty, 'DISGUISED_ADVERTISEMENT')[0];
  assert.ok(f);
  assert.ok(f.evidence.fontSizePx < f.evidence.bodyFontSizePx * 0.75);
  assert.ok(f.evidence.contrastRatio < 4.5);
});

test('DRIP_PRICING: fee lines are caught and flagged as indicative only', () => {
  const f = get(dirty, 'DRIP_PRICING');
  assert.ok(f.length >= 2, 'convenience fee and platform fee');
  assert.ok(f.every((x) => x.confidence === 'INDICATIVE'),
    'proving drip pricing needs a full checkout flow, so a page scan must not overclaim');
});

/* ===================================================================== *
 * REPORT INTEGRITY. The part that makes it usable as compliance evidence.
 * ===================================================================== */

test('the report always declares the four patterns it CANNOT check', () => {
  for (const report of [dirty, clean]) {
    const ids = report.notChecked.map((n) => n.pattern);
    for (const id of ['SUBSCRIPTION_TRAP', 'BAIT_AND_SWITCH', 'SAAS_BILLING', 'ROGUE_MALWARE']) {
      assert.ok(ids.includes(id), `${id} must be declared unchecked, never silently omitted`);
    }
  }
});

test('every unchecked pattern states WHY, so the gap cannot be mistaken for a pass', () => {
  for (const n of clean.notChecked) {
    assert.ok(n.reason && n.reason.length > 40, `${n.pattern} needs a real reason`);
  }
});

test('a clean scan does NOT claim all thirteen patterns were checked', () => {
  assert.ok(clean.summary.patternsNotChecked >= 4);
  assert.ok(clean.summary.patternsChecked < clean.summary.patternsInGuidelines);
});

test('the disclaimer refuses to let absence be read as compliance', () => {
  assert.match(clean.disclaimer, /absence from the findings is not evidence of compliance/);
});

test('every finding carries a rule id and evidence, never a bare opinion', () => {
  for (const f of dirty.findings) {
    assert.ok(f.rule, 'finding without a rule id');
    assert.ok(f.evidence && Object.keys(f.evidence).length > 0, `${f.pattern} has no evidence`);
    assert.ok(['PROVEN', 'STRONG', 'INDICATIVE'].includes(f.confidence));
  }
});

test('no detector crashed silently', () => {
  assert.deepEqual(dirty.detectorErrors, []);
  assert.deepEqual(clean.detectorErrors, []);
});

test('findings are ordered strongest-first so the headline is the best evidence', () => {
  const rank = { PROVEN: 3, STRONG: 2, INDICATIVE: 1 };
  const seq = dirty.findings.map((f) => rank[f.confidence]);
  assert.deepEqual(seq, [...seq].sort((a, b) => b - a));
});

test('every finding maps to a real clause of the 2023 Guidelines', async () => {
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const f of ['registry.js']) await page.addScriptTag({ path: join(ENGINE, f) });
  const clauses = await page.evaluate(() => {
    const K = globalThis.Kasauti;
    return Object.fromEntries(K.ORDER.map((id) => [id, K.PATTERNS[id].clause]));
  });
  await page.close();
  for (const f of dirty.findings) {
    assert.match(clauses[f.pattern] ?? '', /^Annexure 1\(\d+\)$/,
      `${f.pattern} must cite a guideline clause`);
  }
});
