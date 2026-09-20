import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseClaim, InvalidClaim, describeClaim, ASSERTION } from './claim.js';

const base = {
  subject: { lat: 19.076, lon: 72.8777, radiusKm: 10, label: 'Mumbai' },
  window: { start: '2026-08-05T00:00:00Z', end: '2026-08-12T00:00:00Z' },
  assertion: { kind: 'RAINFALL_EXCEEDED', thresholdMm: 100 },
};

test('a valid claim normalises and freezes', () => {
  const c = normaliseClaim(base);
  assert.equal(c.assertion.kind, ASSERTION.RAINFALL_EXCEEDED);
  assert.equal(Object.isFrozen(c), true);
});

test('normalisation is idempotent, so identical claims hash identically', () => {
  assert.deepEqual(normaliseClaim(base), normaliseClaim(normaliseClaim(base)));
});

test('differently-expressed but identical timestamps normalise to one form', () => {
  const a = normaliseClaim(base);
  const b = normaliseClaim({ ...base, window: { start: '2026-08-05T00:00:00.000Z', end: '2026-08-12T00:00:00Z' } });
  assert.equal(a.window.start, b.window.start);
});

test('out-of-range coordinates are rejected', () => {
  assert.throws(() => normaliseClaim({ ...base, subject: { ...base.subject, lat: 91 } }), InvalidClaim);
  assert.throws(() => normaliseClaim({ ...base, subject: { ...base.subject, lon: -181 } }), InvalidClaim);
});

test('an inverted window is rejected', () => {
  assert.throws(
    () => normaliseClaim({ ...base, window: { start: '2026-08-12T00:00:00Z', end: '2026-08-05T00:00:00Z' } }),
    InvalidClaim,
  );
});

test('a threshold-bearing assertion without its threshold is rejected', () => {
  assert.throws(
    () => normaliseClaim({ ...base, assertion: { kind: 'RAINFALL_EXCEEDED' } }),
    /requires a numeric assertion.thresholdMm/,
  );
  assert.throws(
    () => normaliseClaim({ ...base, assertion: { kind: 'SEISMIC_EVENT' } }),
    /requires a numeric assertion.minMagnitude/,
  );
});

test('unknown assertion kinds and uses are rejected rather than ignored', () => {
  assert.throws(() => normaliseClaim({ ...base, assertion: { kind: 'VIBES' } }), InvalidClaim);
  assert.throws(() => normaliseClaim({ ...base, intendedUse: 'FREE_FOR_ALL' }), InvalidClaim);
});

test('a claim defaults to NONCOMMERCIAL use — the restrictive default', () => {
  assert.equal(normaliseClaim(base).intendedUse, 'NONCOMMERCIAL');
});

test('a claim renders as the English sentence it asserts', () => {
  const s = describeClaim(normaliseClaim(base));
  assert.match(s, /exceeded 100 mm/);
  assert.match(s, /Mumbai/);
  assert.match(s, /2026-08-05T00:00:00Z/);
});
