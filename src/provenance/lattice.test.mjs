import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DERIVATION, DERIVATION_RANK, OPERATION, OPERATION_CEILING, STATUS,
  rankOf, meet, combine, applyStaleness, corroborate,
} from './lattice.js';

const ALL_DERIVATIONS = Object.keys(DERIVATION_RANK);
const ALL_OPERATIONS = Object.keys(OPERATION_CEILING);

/* ------------------------------------------------------------------------ *
 * THE CENTRAL THEOREM
 *
 * No operation, over any inputs, may produce a result stronger than the
 * weakest input. Exhaustively checked over the whole lattice (5^2 input
 * pairs x 5 operations = 125 cases) rather than spot-checked, because this
 * is the one property the entire product rests on.
 * ------------------------------------------------------------------------ */
test('THEOREM: no operation increases derivation rank above its weakest input', () => {
  for (const a of ALL_DERIVATIONS) {
    for (const b of ALL_DERIVATIONS) {
      for (const op of ALL_OPERATIONS) {
        const out = combine({ inputs: [a, b], operation: op });
        const weakestInput = Math.min(rankOf(a), rankOf(b));
        assert.ok(
          rankOf(out) <= weakestInput,
          `${op}(${a},${b}) = ${out} exceeded weakest input rank ${weakestInput}`,
        );
      }
    }
  }
});

test('THEOREM: no operation exceeds its own ceiling, however strong the inputs', () => {
  for (const op of ALL_OPERATIONS) {
    const out = combine({ inputs: [DERIVATION.OBSERVED, DERIVATION.OBSERVED], operation: op });
    assert.equal(rankOf(out), OPERATION_CEILING[op],
      `${op} over pristine observations should sit exactly at its ceiling`);
  }
});

test('feeding observations into a model yields a model, not an observation', () => {
  // The single most commonly laundered claim in the industry.
  assert.equal(
    combine({ inputs: [DERIVATION.OBSERVED], operation: OPERATION.MODEL }),
    DERIVATION.MODELED,
  );
});

test('a single simulated input contaminates an otherwise pristine computation', () => {
  assert.equal(
    combine({
      inputs: [DERIVATION.OBSERVED, DERIVATION.OBSERVED, DERIVATION.SIMULATED],
      operation: OPERATION.DETERMINISTIC,
    }),
    DERIVATION.SIMULATED,
  );
});

test('meet with no inputs is SIMULATED, not OBSERVED', () => {
  // Fails open in the safe direction: a value with no stated lineage is
  // treated as generated, never as measured.
  assert.equal(meet([]), DERIVATION.SIMULATED);
});

test('combine is order-independent (meet is commutative)', () => {
  for (const op of ALL_OPERATIONS) {
    for (const a of ALL_DERIVATIONS) {
      for (const b of ALL_DERIVATIONS) {
        assert.equal(
          combine({ inputs: [a, b], operation: op }),
          combine({ inputs: [b, a], operation: op }),
        );
      }
    }
  }
});

test('combine is idempotent under IDENTITY', () => {
  for (const d of ALL_DERIVATIONS) {
    assert.equal(combine({ inputs: [d], operation: OPERATION.IDENTITY }), d);
  }
});

test('chaining operations is monotonically non-increasing', () => {
  let current = DERIVATION.OBSERVED;
  const chain = [OPERATION.IDENTITY, OPERATION.DETERMINISTIC, OPERATION.MODEL, OPERATION.DETERMINISTIC];
  let previousRank = rankOf(current);
  for (const op of chain) {
    current = combine({ inputs: [current], operation: op });
    assert.ok(rankOf(current) <= previousRank, `rank rose at ${op}`);
    previousRank = rankOf(current);
  }
  // DETERMINISTIC after MODEL must NOT restore DERIVED rank.
  assert.equal(current, DERIVATION.MODELED);
});

/* ------------------------------- staleness ------------------------------- */

test('a fresh observation is untouched', () => {
  const r = applyStaleness({ derivation: DERIVATION.OBSERVED, ageSeconds: 30, validSeconds: 60 });
  assert.equal(r.derivation, DERIVATION.OBSERVED);
  assert.equal(r.stale, false);
});

test('a stale observation is silently an extrapolation, so it is demoted', () => {
  const r = applyStaleness({ derivation: DERIVATION.OBSERVED, ageSeconds: 120, validSeconds: 60 });
  assert.equal(r.derivation, DERIVATION.MODELED);
  assert.equal(r.stale, true);
  assert.equal(r.demotedBy, 'STALE');
});

test('an observation far beyond its horizon is a guess', () => {
  const r = applyStaleness({ derivation: DERIVATION.OBSERVED, ageSeconds: 10_000, validSeconds: 60 });
  assert.equal(r.derivation, DERIVATION.ESTIMATED);
  assert.equal(r.demotedBy, 'STALE_BEYOND_HORIZON');
});

test('staleness never promotes a weak value', () => {
  const r = applyStaleness({ derivation: DERIVATION.SIMULATED, ageSeconds: 10_000, validSeconds: 60 });
  assert.equal(r.derivation, DERIVATION.SIMULATED);
});

/* ------------------------------ corroboration ---------------------------- */

test('THEOREM: agreement raises confidence but never raises derivation rank', () => {
  const tenAgreeingEstimates = Array.from({ length: 10 }, (_, i) => ({
    derivation: DERIVATION.ESTIMATED,
    status: STATUS.POSITIVE,
    lineageRoot: `src-${i}`,
  }));
  const r = corroborate(tenAgreeingEstimates);
  assert.equal(r.derivation, DERIVATION.ESTIMATED, 'consensus must not launder estimates into observations');
  assert.equal(r.agreement, 1);
  assert.ok(r.confidence > 0 && r.confidence < 1);
});

test('feeds sharing an upstream lineage root count as ONE independent source', () => {
  const sameUpstreamTwice = [
    { derivation: DERIVATION.OBSERVED, status: STATUS.POSITIVE, lineageRoot: 'usgs' },
    { derivation: DERIVATION.DERIVED,  status: STATUS.POSITIVE, lineageRoot: 'usgs' },
  ];
  assert.equal(corroborate(sameUpstreamTwice).independentSources, 1);
});

test('INDETERMINATE evidence is discarded, not counted as a vote', () => {
  const r = corroborate([
    { derivation: DERIVATION.OBSERVED, status: STATUS.POSITIVE, lineageRoot: 'a' },
    { derivation: DERIVATION.OBSERVED, status: STATUS.INDETERMINATE, lineageRoot: 'b' },
    { derivation: DERIVATION.OBSERVED, status: STATUS.INDETERMINATE, lineageRoot: 'c' },
  ]);
  assert.equal(r.independentSources, 1);
  assert.equal(r.status, STATUS.POSITIVE);
  assert.equal(r.agreement, 1, 'sources that could not see it must not dilute agreement');
});

test('no usable evidence yields INDETERMINATE with zero confidence', () => {
  const r = corroborate([{ derivation: DERIVATION.OBSERVED, status: STATUS.INDETERMINATE, lineageRoot: 'a' }]);
  assert.equal(r.status, STATUS.INDETERMINATE);
  assert.equal(r.confidence, 0);
});

test('confidence is monotone in independent source count', () => {
  const mk = (n) => corroborate(Array.from({ length: n }, (_, i) => ({
    derivation: DERIVATION.OBSERVED, status: STATUS.POSITIVE, lineageRoot: `s${i}`,
  })).concat([])).confidence;
  assert.ok(mk(1) < mk(2) && mk(2) < mk(4), 'more independent agreeing sources must not lower confidence');
});

/* --------------------------- temporality ---------------------------------- *
 * Regression: an earlier build applied STATE decay to catalogued EVENTS, which
 * silently downgraded every historical record to ESTIMATED. Since retrospective
 * queries are most of what an evidence engine does, that one bug would have
 * quietly gutted the provenance of nearly every verdict it ever issued.
 * -------------------------------------------------------------------------- */
import { TEMPORALITY } from './lattice.js';

test('REGRESSION: a month-old EVENT record does not decay', () => {
  const monthOld = 30 * 24 * 3600;
  const r = applyStaleness({
    derivation: DERIVATION.OBSERVED,
    ageSeconds: monthOld,
    validSeconds: 3600,
    temporality: TEMPORALITY.EVENT,
  });
  assert.equal(r.derivation, DERIVATION.OBSERVED, 'a timestamped occurrence is as true today as it was then');
  assert.equal(r.stale, false);
});

test('the same age DOES decay a STATE observation', () => {
  const r = applyStaleness({
    derivation: DERIVATION.OBSERVED,
    ageSeconds: 30 * 24 * 3600,
    validSeconds: 3600,
    temporality: TEMPORALITY.STATE,
  });
  assert.equal(r.derivation, DERIVATION.ESTIMATED);
});

test('STATE is the default, so an adapter that forgets to declare fails safe', () => {
  const r = applyStaleness({ derivation: DERIVATION.OBSERVED, ageSeconds: 7200, validSeconds: 3600 });
  assert.equal(r.stale, true, 'omitting temporality must decay, not preserve');
});
