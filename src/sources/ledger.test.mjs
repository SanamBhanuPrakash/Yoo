import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedger, CLOUD_THRESHOLD, BLIND_WINDOW_DAYS } from './sentinelWitness.js';
import { analyseTerrain, RELATIVE_NOISE_M } from './terrain.js';

/* ======================================================================== *
 * BLIND WINDOW LEDGER
 * The commercial core. If this miscounts, the product lies in the direction
 * that costs a buyer money, so it is tested against constructed histories
 * rather than trusted because it looked right once on live data.
 * ======================================================================== */

const WINDOW = { start: '2026-01-01T00:00:00Z', end: '2026-12-31T00:00:00Z' };
const pass = (date, cloud) => ({ sceneId: date, at: `${date}T05:30:00Z`, cloudCover: cloud });

test('a cloudy pass is not a look', () => {
  const l = buildLedger([pass('2026-06-01', 95), pass('2026-06-06', 3)], WINDOW);
  assert.equal(l.passes, 2);
  assert.equal(l.clearPasses, 1, 'only the clear acquisition counts as an observation');
});

test('the cloud threshold is the documented one', () => {
  const justUnder = buildLedger([pass('2026-06-01', CLOUD_THRESHOLD - 0.1)], WINDOW);
  const justOver = buildLedger([pass('2026-06-01', CLOUD_THRESHOLD + 0.1)], WINDOW);
  assert.equal(justUnder.clearPasses, 1);
  assert.equal(justOver.clearPasses, 0);
});

test('missing cloud metadata is treated as unusable, not as clear', () => {
  // Fails safe: an unknown is never promoted into a look.
  const l = buildLedger([{ sceneId: 'x', at: '2026-06-01T05:30:00Z', cloudCover: null }], WINDOW);
  assert.equal(l.clearPasses, 0);
});

test('THE CORE: a genuine monsoon gap is measured to the day', () => {
  // Explicit dates rather than arithmetic, so the expected gap is readable
  // from the test itself: clear every 5 days up to 10 June, cloud through the
  // monsoon, clear again from 3 September.
  const every5 = (fromIso, toIso) => {
    const out = [];
    for (let t = Date.parse(fromIso); t <= Date.parse(toIso); t += 5 * 86_400_000) {
      out.push(pass(new Date(t).toISOString().slice(0, 10), 2));
    }
    return out;
  };
  const l = buildLedger([
    ...every5('2026-01-01', '2026-06-10'),
    ...['2026-06-20', '2026-07-05', '2026-07-20', '2026-08-15'].map((d) => pass(d, 98)),
    ...every5('2026-09-03', '2026-12-31'),
  ], WINDOW);

  assert.equal(l.blindWindows.length, 1, `phantom gaps: ${JSON.stringify(l.blindWindows)}`);
  const gap = l.blindWindows[0];
  assert.equal(gap.from, '2026-06-10', 'the gap starts at the last usable view');
  assert.equal(gap.to, '2026-09-03', 'and ends at the next one');
  assert.equal(gap.days, 85, 'measured to the day, not rounded to a month');
  assert.equal(l.longestBlindDays, 85);
});

test('REGRESSION: a gap at the START of the window is reported, not skipped', () => {
  // The naive implementation walks between observations and silently loses the
  // stretch before the first one -- exactly the stretch a buyer most wants,
  // because it is the period just before the plot came up for sale.
  const l = buildLedger([pass('2026-05-01', 2), pass('2026-05-06', 2)], WINDOW);
  const leading = l.blindWindows.find((w) => w.from === '2026-01-01');
  assert.ok(leading, 'the unobserved run from window start must appear');
  assert.equal(leading.boundedByWindowEdge, true);
});

test('REGRESSION: a gap at the END of the window is reported', () => {
  const l = buildLedger([pass('2026-01-05', 2), pass('2026-01-10', 2)], WINDOW);
  const trailing = l.blindWindows.find((w) => w.to === '2026-12-31');
  assert.ok(trailing, 'an unobserved run to window end must appear');
  assert.ok(trailing.days > 300);
});

test('dense clear coverage produces no blind windows at all', () => {
  const passes = [];
  for (let d = 1; d <= 360; d += 5) {
    passes.push(pass(new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10), 1));
  }
  const l = buildLedger(passes, WINDOW);
  assert.equal(l.longestBlindDays, 0);
  assert.equal(l.blindWindows.length, 0);
  assert.ok(l.meanRevisitDays <= 6);
});

test('gaps shorter than the reporting threshold are not inflated into findings', () => {
  // Runs to the window edge deliberately: a trailing stub shorter than the
  // threshold must stay silent rather than becoming a scary-looking finding.
  const passes = [];
  for (let d = 1; d <= 365; d += BLIND_WINDOW_DAYS - 2) {
    passes.push(pass(new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10), 1));
  }
  const l = buildLedger(passes, WINDOW);
  assert.equal(l.blindWindows.length, 0, `unexpected findings: ${JSON.stringify(l.blindWindows)}`);
  assert.equal(l.longestBlindDays, 0);
});

test('zero passes means the whole window is blind, not zero blind days', () => {
  const l = buildLedger([], WINDOW);
  assert.equal(l.passes, 0);
  assert.ok(l.longestBlindDays > 300, 'no observations must read as total blindness');
  assert.equal(l.blindDaysFraction, 1);
});

test('blind windows are ranked longest-first so the headline is the worst one', () => {
  const l = buildLedger([
    pass('2026-01-02', 1), pass('2026-02-01', 1), pass('2026-08-01', 1), pass('2026-08-05', 1),
  ], WINDOW);
  const days = l.blindWindows.map((w) => w.days);
  assert.deepEqual(days, [...days].sort((a, b) => b - a));
});

/* ======================================================================== *
 * TERRAIN
 * Tested against constructed landscapes: a bowl, a ridge, a hillside, a plain.
 * ======================================================================== */

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
function landscape(centreM, elevationAt) {
  const out = [{ lat: 0, lon: 0, ring: 0, bearing: null, elevationM: centreM }];
  for (const ring of [60, 150, 300]) {
    for (const bearing of BEARINGS) {
      out.push({ lat: 0, lon: 0, ring, bearing, elevationM: elevationAt(ring, bearing) });
    }
  }
  return out;
}

test('a closed bowl is identified as ponding ground', () => {
  const t = analyseTerrain(landscape(100, (ring) => 100 + ring / 10));
  assert.equal(t.classification, 'CLOSED_DEPRESSION');
  assert.equal(t.closedDepression, true);
  assert.ok(t.depressionM > 0);
  assert.match(t.waterBehaviour, /pond/);
});

test('a bowl with one low side drains rather than ponds', () => {
  const t = analyseTerrain(landscape(100, (ring, b) => (b === 180 ? 100 - ring / 60 : 100 + ring / 10)));
  assert.equal(t.classification, 'OPEN_DEPRESSION');
  assert.equal(t.closedDepression, false);
  assert.deepEqual(t.drainageBearings, ['S'], 'the escape direction is reported once, not per ring');
});

test('REGRESSION: drainage bearings are deduplicated across rings', () => {
  // Sampling three rings at the same bearing once produced "S, S, S".
  const t = analyseTerrain(landscape(100, (ring, b) => (b === 180 ? 99 : 100 + ring / 10)));
  assert.equal(new Set(t.drainageBearings).size, t.drainageBearings.length);
});

test('REGRESSION: a hillside is classified as slope, not as a hollow', () => {
  // A uniform gradient makes uphill cancel downhill, so `depressionM` lands
  // near zero and means nothing. Diagnosing slope first is what stops a
  // Himalayan hillside being described in the vocabulary of a Deccan hollow.
  const t = analyseTerrain(landscape(1000, (ring, b) => 1000 + ring * Math.cos((b * Math.PI) / 180) * 0.3));
  assert.equal(t.classification, 'SLOPING_GROUND');
  assert.ok(t.gradientPct > 5);
  assert.equal(t.slopeDominated, true);
});

test('a shallow dip inside the noise floor is INDISTINGUISHABLE, never a finding', () => {
  const t = analyseTerrain(landscape(100, () => 100 + (RELATIVE_NOISE_M - 1)));
  assert.equal(t.classification, 'INDISTINGUISHABLE');
  assert.equal(t.significant, false);
  assert.match(t.waterBehaviour, /NOT a finding of level ground/);
  assert.equal(t.conclusionDerivation, null, 'no conclusion may be drawn below the noise floor');
});

test('a dip just above the noise floor IS reported', () => {
  const t = analyseTerrain(landscape(100, () => 100 + RELATIVE_NOISE_M + 1));
  assert.equal(t.significant, true);
  assert.equal(t.classification, 'CLOSED_DEPRESSION');
});

test('a local high is identified as shedding water', () => {
  const t = analyseTerrain(landscape(120, () => 100));
  assert.equal(t.classification, 'ELEVATED');
  assert.match(t.waterBehaviour, /runs off it/);
});

test('every terrain result carries its provenance chain and the surface-model caveat', () => {
  const t = analyseTerrain(landscape(100, () => 110));
  assert.match(t.provenanceNote, /OBSERVED.*DERIVED.*ESTIMATED/s);
  assert.match(t.provenanceNote, /NOT a flood model/);
  assert.match(t.surfaceModelCaveat, /measures the ROOF or the TREETOP/);
});

test('the water conclusion is never stronger than ESTIMATED', () => {
  for (const build of [() => 110, () => 90, (r, b) => 100 + r * Math.cos(b) * 0.3]) {
    const t = analyseTerrain(landscape(100, build));
    assert.ok(t.conclusionDerivation === null || t.conclusionDerivation === 'ESTIMATED',
      'a topographic heuristic must never present itself as measurement');
  }
});
