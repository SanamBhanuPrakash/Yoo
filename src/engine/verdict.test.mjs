import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, VERDICT, REFUTATION_FLOOR } from './verdict.js';
import { DERIVATION, STATUS } from '../provenance/lattice.js';

const finding = (over = {}) => ({
  sourceId: 'src-a', lineageRoot: 'a', derivation: DERIVATION.OBSERVED,
  status: STATUS.POSITIVE, observability: { index: 1, blockers: [] },
  corroborationOnly: false, ...over,
});

const MIN = DERIVATION.SIMULATED;

test('a well-observed positive is SUPPORTED', () => {
  const r = decide({ findings: [finding()], minimumDerivation: MIN });
  assert.equal(r.verdict, VERDICT.SUPPORTED);
  assert.equal(r.derivation, DERIVATION.OBSERVED);
});

/* ------------------------------------------------------------------------ *
 * THE DISTINCTION THAT JUSTIFIES THE WHOLE SYSTEM
 * ------------------------------------------------------------------------ */

test('a negative from a HIGH-observability source is REFUTED', () => {
  const r = decide({
    findings: [finding({ status: STATUS.NEGATIVE, observability: { index: 0.9, blockers: [] } })],
    minimumDerivation: MIN,
  });
  assert.equal(r.verdict, VERDICT.REFUTED);
  assert.match(r.reason, /demonstrably had the coverage/);
});

test('the SAME negative from a LOW-observability source is UNSUPPORTED, never REFUTED', () => {
  const r = decide({
    findings: [finding({ status: STATUS.NEGATIVE, observability: { index: 0.2, blockers: [] } })],
    minimumDerivation: MIN,
  });
  assert.equal(r.verdict, VERDICT.UNSUPPORTED);
  assert.match(r.reason, /NOT refuted/);
  assert.ok(r.trace.some((t) => t.rule === 'BELOW_REFUTATION_FLOOR'));
});

test('a source that could not have seen it is excluded entirely, yielding INDETERMINATE', () => {
  const r = decide({
    findings: [finding({ status: STATUS.NEGATIVE, observability: { index: 0, blockers: ['TEMPORAL_COVERAGE'] } })],
    minimumDerivation: MIN,
  });
  assert.equal(r.verdict, VERDICT.INDETERMINATE);
  assert.ok(r.trace.some((t) => t.rule === 'ZERO_OBSERVABILITY'));
  assert.match(r.reason, /absence of evidence/);
});

test('the refutation bar is higher than the support bar (deliberate asymmetry)', () => {
  const weak = { index: 0.1, blockers: [] };
  const positive = decide({ findings: [finding({ observability: weak })], minimumDerivation: MIN });
  const negative = decide({ findings: [finding({ status: STATUS.NEGATIVE, observability: weak })], minimumDerivation: MIN });
  assert.equal(positive.verdict, VERDICT.SUPPORTED, 'weak coverage that DID see something still counts');
  assert.equal(negative.verdict, VERDICT.UNSUPPORTED, 'weak coverage that saw nothing must not deny');
});

/* --------------------------- corroboration-only -------------------------- */

test('a corroboration-only source can SUPPORT', () => {
  const r = decide({
    findings: [finding({ sourceId: 'gdelt', lineageRoot: 'gdelt', corroborationOnly: true, derivation: DERIVATION.ESTIMATED })],
    minimumDerivation: MIN,
  });
  assert.equal(r.verdict, VERDICT.SUPPORTED);
});

test('a corroboration-only source can NEVER refute, even at perfect observability', () => {
  const r = decide({
    findings: [finding({
      sourceId: 'gdelt', lineageRoot: 'gdelt', corroborationOnly: true,
      status: STATUS.NEGATIVE, observability: { index: 1, blockers: [] },
    })],
    minimumDerivation: MIN,
  });
  assert.notEqual(r.verdict, VERDICT.REFUTED);
  assert.equal(r.verdict, VERDICT.UNSUPPORTED);
  assert.ok(r.trace.some((t) => t.rule === 'CORROBORATION_ONLY'));
});

/* ---------------------------- strength floor ----------------------------- */

test('a verdict below the claim’s minimum derivation is WITHHELD, not downgraded silently', () => {
  const r = decide({
    findings: [finding({ derivation: DERIVATION.ESTIMATED })],
    minimumDerivation: DERIVATION.OBSERVED,
  });
  assert.equal(r.verdict, VERDICT.INDETERMINATE);
  assert.equal(r.withheldVerdict, VERDICT.SUPPORTED, 'the withheld finding is disclosed, not hidden');
  assert.match(r.reason, /below the OBSERVED floor/);
});

test('the same evidence passes when the claim asks for less', () => {
  const r = decide({
    findings: [finding({ derivation: DERIVATION.ESTIMATED })],
    minimumDerivation: DERIVATION.ESTIMATED,
  });
  assert.equal(r.verdict, VERDICT.SUPPORTED);
});

/* ------------------------------- mixtures -------------------------------- */

test('a positive outweighs a negative rather than cancelling to INDETERMINATE', () => {
  const r = decide({
    findings: [
      finding({ sourceId: 'a', lineageRoot: 'a', status: STATUS.POSITIVE }),
      finding({ sourceId: 'b', lineageRoot: 'b', status: STATUS.NEGATIVE, observability: { index: 0.9, blockers: [] } }),
    ],
    minimumDerivation: MIN,
  });
  // Something seen beats something not seen: a sensor that detected an event
  // is stronger evidence than one that did not, given both were looking.
  assert.equal(r.verdict, VERDICT.SUPPORTED);
});

test('two feeds off one upstream count once', () => {
  const r = decide({
    findings: [
      finding({ sourceId: 'a1', lineageRoot: 'shared' }),
      finding({ sourceId: 'a2', lineageRoot: 'shared' }),
    ],
    minimumDerivation: MIN,
  });
  assert.equal(r.independentSources, 1);
});

test('no findings at all is INDETERMINATE with zero confidence', () => {
  const r = decide({ findings: [], minimumDerivation: MIN });
  assert.equal(r.verdict, VERDICT.INDETERMINATE);
  assert.equal(r.confidence, 0);
});

test('the refutation floor is configurable and recorded on the verdict', () => {
  const f = [finding({ status: STATUS.NEGATIVE, observability: { index: 0.4, blockers: [] } })];
  assert.equal(decide({ findings: f, minimumDerivation: MIN }).verdict, VERDICT.UNSUPPORTED);
  const relaxed = decide({ findings: f, minimumDerivation: MIN, refutationFloor: 0.3 });
  assert.equal(relaxed.verdict, VERDICT.REFUTED);
  assert.equal(relaxed.refutationFloor, 0.3, 'the applied threshold must be recorded for the counterparty');
});

test('default refutation floor is documented and stable', () => {
  assert.equal(REFUTATION_FLOOR, 0.6);
});
