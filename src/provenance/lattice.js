/**
 * Provenance lattice — the epistemic core of Sakshya.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every operational dashboard on Earth commits the same sin: it renders an
 * estimate with the same visual authority as a measurement. A propagated
 * satellite position, an interpolated vessel track and a directly observed
 * earthquake magnitude all arrive on screen as a confident number in a box.
 * Downstream, a human (or an LLM) reads all three as fact, and money moves.
 *
 * Sakshya refuses to let that happen by construction. Every value carries a
 * DERIVATION RANK, and the single invariant of this module is:
 *
 *      NO OPERATION MAY INCREASE DERIVATION RANK.
 *
 * You cannot compute your way to a stronger claim than your weakest input
 * allows. This is the same shape as an information-flow / taint lattice in
 * security: secrecy only ever propagates upward, never launders away. Here,
 * *uncertainty* only ever propagates downward, never launders away.
 *
 * TWO INDEPENDENT AXES
 * --------------------
 * A common modelling error is to put "we didn't find anything" on the same
 * scale as "this is an estimate". They are orthogonal. Sakshya separates:
 *
 *   axis 1 — DERIVATION: how was this value produced?
 *   axis 2 — EVIDENTIAL STATUS: what did the source actually tell us?
 *
 * Keeping them apart is what lets the engine distinguish the three answers
 * that every other system collapses into one:
 *
 *   "the flood did not happen"            (NEGATIVE, source had coverage)
 *   "we found no record of the flood"     (NEGATIVE, coverage partial)
 *   "nothing could have seen the flood"   (INDETERMINATE, no coverage)
 *
 * The third one is where fraud lives, and it is the one everybody ships as
 * a green tick.
 *
 * @module provenance/lattice
 */

/**
 * Derivation classes, strongest first. The numeric rank is the lattice order;
 * `meet` (greatest lower bound) is simply `min` over ranks.
 */
export const DERIVATION = Object.freeze({
  /** A primary sensor recorded it and we read it from the publisher of record. */
  OBSERVED: 'OBSERVED',
  /** Deterministic, reversible computation over observed inputs (unit conversion, sum, clip, geometry). */
  DERIVED: 'DERIVED',
  /** A validated physical or statistical model over observed inputs (SGP4, reanalysis, kriging). */
  MODELED: 'MODELED',
  /** A heuristic with assumptions nobody validated (dead reckoning past its horizon, rule-of-thumb). */
  ESTIMATED: 'ESTIMATED',
  /** Synthetic. No observational input stands behind *this instance* of the value. */
  SIMULATED: 'SIMULATED',
});

/** Lattice order. Higher = epistemically stronger. */
export const DERIVATION_RANK = Object.freeze({
  OBSERVED: 5,
  DERIVED: 4,
  MODELED: 3,
  ESTIMATED: 2,
  SIMULATED: 1,
});

/**
 * Operation ceilings. An operation can never produce a result stronger than
 * its own ceiling, regardless of how strong its inputs were.
 *
 * This is the half people forget. Feeding OBSERVED inputs into a model does
 * not yield an observation — it yields a model output that happens to be
 * well fed. Ceilings enforce that.
 */
export const OPERATION = Object.freeze({
  /** Pass-through of a source value; changes nothing. */
  IDENTITY: 'IDENTITY',
  /** Deterministic arithmetic/geometry with no free parameters. */
  DETERMINISTIC: 'DETERMINISTIC',
  /** A published, validated model with stated error characteristics. */
  MODEL: 'MODEL',
  /** A heuristic. Defensible, but unvalidated for this use. */
  HEURISTIC: 'HEURISTIC',
  /** Generation of values with no observational basis. */
  SYNTHETIC: 'SYNTHETIC',
});

export const OPERATION_CEILING = Object.freeze({
  IDENTITY: DERIVATION_RANK.OBSERVED,
  DETERMINISTIC: DERIVATION_RANK.DERIVED,
  MODEL: DERIVATION_RANK.MODELED,
  HEURISTIC: DERIVATION_RANK.ESTIMATED,
  SYNTHETIC: DERIVATION_RANK.SIMULATED,
});

/**
 * Evidential status — the orthogonal axis. What did the source say?
 */
export const STATUS = Object.freeze({
  /** The source affirmatively reported the thing. */
  POSITIVE: 'POSITIVE',
  /** The source answered, was capable of seeing the thing, and did not report it. */
  NEGATIVE: 'NEGATIVE',
  /** The source could not have seen it, or did not answer. Carries no evidential weight either way. */
  INDETERMINATE: 'INDETERMINATE',
});

const RANK_TO_NAME = Object.freeze(
  Object.fromEntries(Object.entries(DERIVATION_RANK).map(([k, v]) => [v, k])),
);

/** @param {string} derivation @returns {number} */
export function rankOf(derivation) {
  const r = DERIVATION_RANK[derivation];
  if (r === undefined) throw new TypeError(`unknown derivation class: ${String(derivation)}`);
  return r;
}

/** @param {number} rank @returns {string} */
export function derivationOfRank(rank) {
  const name = RANK_TO_NAME[rank];
  if (name === undefined) throw new RangeError(`no derivation class at rank ${rank}`);
  return name;
}

/**
 * Lattice meet: the greatest lower bound of a set of derivation classes.
 * A chain of reasoning is exactly as strong as its weakest link.
 *
 * @param {string[]} derivations
 * @returns {string}
 */
export function meet(derivations) {
  if (!Array.isArray(derivations) || derivations.length === 0) {
    // No inputs means nothing observational stands behind the value.
    return DERIVATION.SIMULATED;
  }
  return derivationOfRank(Math.min(...derivations.map(rankOf)));
}

/**
 * THE central function. Given the derivation classes of the inputs and the
 * operation applied to them, return the derivation class of the result.
 *
 * result = min( meet(inputs), ceiling(operation) )
 *
 * Two independent ways to lose rank, and no way at all to gain it.
 *
 * @param {object} args
 * @param {string[]} args.inputs   derivation classes of the input values
 * @param {string}   args.operation an OPERATION key
 * @returns {string} derivation class of the result
 */
export function combine({ inputs, operation }) {
  const ceiling = OPERATION_CEILING[operation];
  if (ceiling === undefined) throw new TypeError(`unknown operation: ${String(operation)}`);
  const inputRank = rankOf(meet(inputs));
  return derivationOfRank(Math.min(inputRank, ceiling));
}

/**
 * Temporality — which kind of fact is this?
 *
 * A distinction that looks academic and is not. Staleness decay applies to one
 * of these and is nonsense on the other:
 *
 *   STATE  — a continuously-varying quantity sampled at an instant: where the
 *            vessel is, what the temperature is. The sample describes NOW, so
 *            it decays: a four-hour-old position is not a position, it is an
 *            extrapolation you are performing silently.
 *
 *   EVENT  — a timestamped occurrence: an earthquake happened at 17:00:39Z, a
 *            payment cleared, a threshold was crossed. It does not decay. An
 *            earthquake from last month is exactly as true today as it was an
 *            hour after it happened.
 *
 * Applying STATE decay to EVENT records is a real and common bug — it silently
 * downgrades every historical record in a retrospective query, which is most
 * of what an evidence system does. What DOES matter for an EVENT is whether
 * the publishing catalogue has settled (reviewed vs automatic solutions), and
 * that is handled as an observability LATENCY factor, not as staleness.
 */
export const TEMPORALITY = Object.freeze({
  STATE: 'STATE',
  EVENT: 'EVENT',
});

/**
 * Staleness is not a derivation class — it is a *demotion rule*.
 *
 * Applies to STATE only. Callers must pass `temporality`; EVENT records are
 * returned untouched.
 *
 * An observation is only an observation for as long as the thing it measured
 * plausibly still holds. A vessel position from four hours ago is not an
 * observation of where the vessel is now; it is an extrapolation you are
 * performing silently. Past its validity window, an OBSERVED value is capped
 * at MODELED, and past a hard horizon it degrades to ESTIMATED.
 *
 * @param {object} args
 * @param {string} args.derivation   current derivation class
 * @param {number} args.ageSeconds   age of the underlying observation
 * @param {number} args.validSeconds how long the source's value stays valid
 * @param {number} [args.horizonMultiple=6] multiple of validSeconds beyond which it is a guess
 * @returns {{derivation: string, stale: boolean, demotedBy: string|null}}
 */
export function applyStaleness({ derivation, ageSeconds, validSeconds, horizonMultiple = 6, temporality = TEMPORALITY.STATE }) {
  if (temporality === TEMPORALITY.EVENT) {
    // A timestamped occurrence does not become less true with age.
    return { derivation, stale: false, demotedBy: null, notApplicable: 'EVENT records do not decay' };
  }
  if (!Number.isFinite(ageSeconds) || !Number.isFinite(validSeconds) || validSeconds <= 0) {
    return { derivation, stale: false, demotedBy: null };
  }
  if (ageSeconds <= validSeconds) {
    return { derivation, stale: false, demotedBy: null };
  }
  const beyondHorizon = ageSeconds > validSeconds * horizonMultiple;
  const cap = beyondHorizon ? DERIVATION_RANK.ESTIMATED : DERIVATION_RANK.MODELED;
  const capped = Math.min(rankOf(derivation), cap);
  const next = derivationOfRank(capped);
  return {
    derivation: next,
    stale: true,
    demotedBy: next === derivation ? null : (beyondHorizon ? 'STALE_BEYOND_HORIZON' : 'STALE'),
  };
}

/**
 * Corroboration across independent sources.
 *
 * Deliberately conservative: agreement between sources RAISES CONFIDENCE but
 * NEVER RAISES DERIVATION RANK. Ten estimates that agree are still ten
 * estimates. This is the rule that stops a model being laundered into an
 * observation by consensus — the exact failure mode behind most "AI said so"
 * incidents.
 *
 * Independence matters: two feeds that both re-publish the same upstream are
 * one source wearing two hats, so callers pass the upstream lineage root and
 * duplicates are collapsed before counting.
 *
 * @param {Array<{derivation: string, status: string, lineageRoot: string, weight?: number}>} claims
 * @returns {{derivation: string, status: string, independentSources: number, agreement: number, confidence: number}}
 */
export function corroborate(claims) {
  const usable = (claims ?? []).filter((c) => c && c.status !== STATUS.INDETERMINATE);
  if (usable.length === 0) {
    return {
      derivation: DERIVATION.SIMULATED,
      status: STATUS.INDETERMINATE,
      independentSources: 0,
      agreement: 0,
      confidence: 0,
    };
  }

  // Collapse feeds sharing an upstream lineage root; keep the strongest of each.
  const byRoot = new Map();
  for (const c of usable) {
    const root = c.lineageRoot ?? 'anonymous';
    const prev = byRoot.get(root);
    if (!prev || rankOf(c.derivation) > rankOf(prev.derivation)) byRoot.set(root, c);
  }
  const independent = [...byRoot.values()];

  const positives = independent.filter((c) => c.status === STATUS.POSITIVE);
  const negatives = independent.filter((c) => c.status === STATUS.NEGATIVE);
  const majority = positives.length >= negatives.length ? positives : negatives;
  const status = positives.length >= negatives.length ? STATUS.POSITIVE : STATUS.NEGATIVE;

  // Rank of the verdict = the STRONGEST evidence supporting the winning side,
  // floored by the fact that a single source can never exceed its own rank.
  const derivation = derivationOfRank(Math.max(...majority.map((c) => rankOf(c.derivation))));

  const agreement = majority.length / independent.length;

  // Confidence is a separate, bounded quantity. It is NOT a probability of
  // truth; it is a monotone summary of (rank, agreement, independence) used
  // only for ranking and display. Kept explicitly out of the lattice so that
  // nobody can trade confidence for rank.
  const rankFactor = rankOf(derivation) / DERIVATION_RANK.OBSERVED;
  const independenceFactor = 1 - 1 / (1 + independent.length);
  const confidence = round4(rankFactor * agreement * independenceFactor);

  return {
    derivation,
    status,
    independentSources: independent.length,
    agreement: round4(agreement),
    confidence,
  };
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Human-readable one-line explanation of a derivation class. Used verbatim on
 * the evidence certificate, because a certificate a lay reader cannot parse
 * is not evidence, it is decoration.
 */
export const DERIVATION_GLOSS = Object.freeze({
  OBSERVED: 'A primary sensor recorded this and we read it from the publisher of record.',
  DERIVED: 'Computed deterministically from observations; reproducible from the same inputs.',
  MODELED: 'Produced by a published model fed with observations; carries the model’s error.',
  ESTIMATED: 'Produced by a heuristic whose assumptions have not been validated for this case.',
  SIMULATED: 'Generated. No observation stands behind this particular value.',
});

export const STATUS_GLOSS = Object.freeze({
  POSITIVE: 'The source affirmatively reported this.',
  NEGATIVE: 'The source was able to see this and did not report it.',
  INDETERMINATE: 'The source could not have seen this, or did not answer. It proves nothing either way.',
});
