/**
 * Verdict algebra.
 *
 * THE FOUR-WAY DISTINCTION
 * ------------------------
 * Nearly every verification system in production ships a boolean, or a
 * boolean wearing a percentage. Sakshya returns one of four, because the
 * difference between the middle two is where money is lost:
 *
 *   SUPPORTED     evidence affirms the claim
 *   REFUTED       evidence contradicts it, AND the sources could have seen it
 *   UNSUPPORTED   nothing was found, but coverage was too weak to refute
 *   INDETERMINATE nothing capable of answering was available at all
 *
 * REFUTED is expensive to earn on purpose. To deny a claim you must first
 * prove you were looking — the REFUTATION_FLOOR below. Systems that collapse
 * UNSUPPORTED into REFUTED are the reason legitimate claims get denied in
 * exactly the places least able to contest the denial: thin sensor coverage,
 * sparse press, no local station. The asymmetry is not a rounding error, it
 * is a distributional injustice with a code path.
 *
 * @module engine/verdict
 */

import { DERIVATION, STATUS, rankOf, corroborate } from '../provenance/lattice.js';

export const VERDICT = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  REFUTED: 'REFUTED',
  UNSUPPORTED: 'UNSUPPORTED',
  INDETERMINATE: 'INDETERMINATE',
  /** The licence gate removed every source capable of answering. */
  BLOCKED: 'BLOCKED',
});

/**
 * Minimum observability index a source must have for its NEGATIVE to count as
 * refutation rather than mere silence. 0.6 is a policy choice, not a natural
 * constant — it is exposed so a counterparty can contract on a different one
 * and the certificate records which value was applied.
 */
export const REFUTATION_FLOOR = 0.6;

/**
 * Minimum observability for a POSITIVE to be accepted. Deliberately much
 * lower than the refutation floor: a source with poor coverage that DID see
 * something has still seen something. Asymmetric by design.
 */
export const SUPPORT_FLOOR = 0.05;

/**
 * @param {object} args
 * @param {Array} args.findings  per-source findings, each with {sourceId, lineageRoot,
 *   derivation, status, observability, corroborationOnly}
 * @param {string} args.minimumDerivation
 * @param {number} [args.refutationFloor]
 */
export function decide({ findings, minimumDerivation, refutationFloor = REFUTATION_FLOOR }) {
  const trace = [];

  // 1. A source that could not have seen the thing contributes nothing, no
  //    matter what it returned. Applied before anything else.
  const admissible = [];
  for (const f of findings) {
    if (f.status === STATUS.INDETERMINATE) {
      trace.push({ rule: 'NO_ANSWER', sourceId: f.sourceId,
        effect: 'excluded', why: f.unavailableReason ?? 'source returned no usable answer' });
      continue;
    }
    if (f.observability.index === 0) {
      trace.push({ rule: 'ZERO_OBSERVABILITY', sourceId: f.sourceId, effect: 'excluded',
        why: `blocked on ${f.observability.blockers.join(', ')} — this source could not have seen the claim` });
      continue;
    }
    admissible.push(f);
  }

  if (admissible.length === 0) {
    return finalise({
      verdict: VERDICT.INDETERMINATE,
      derivation: DERIVATION.SIMULATED,
      confidence: 0,
      trace,
      reason: 'No source was both available and capable of observing this claim. ' +
              'This is an absence of evidence, and is reported as such rather than as a denial.',
      minimumDerivation,
      refutationFloor,
    });
  }

  // 2. Corroboration-only sources may support, never refute. Enforced here so
  //    that an adapter cannot opt itself out of the rule.
  const positives = admissible.filter((f) => f.status === STATUS.POSITIVE && f.observability.index >= SUPPORT_FLOOR);
  const negativesRaw = admissible.filter((f) => f.status === STATUS.NEGATIVE);
  const negatives = [];
  for (const f of negativesRaw) {
    if (f.corroborationOnly) {
      trace.push({ rule: 'CORROBORATION_ONLY', sourceId: f.sourceId, effect: 'negative discarded',
        why: 'this source is registered as corroborative; its silence is not evidence of absence' });
      continue;
    }
    if (f.observability.index < refutationFloor) {
      trace.push({ rule: 'BELOW_REFUTATION_FLOOR', sourceId: f.sourceId, effect: 'negative weakened',
        why: `observability ${f.observability.index} < floor ${refutationFloor}; counted as silence, not contradiction` });
      continue;
    }
    negatives.push(f);
  }

  // 3. Corroborate whatever survived.
  const winning = positives.length > 0 ? positives : negatives;
  if (winning.length === 0) {
    return finalise({
      verdict: VERDICT.UNSUPPORTED,
      derivation: DERIVATION.SIMULATED,
      confidence: 0,
      trace,
      reason:
        'Sources were consulted and none affirmed the claim, but none had sufficient observability ' +
        `(≥ ${refutationFloor}) to make their silence meaningful. The claim is unsupported, NOT refuted: ` +
        'we cannot show we would have detected the event had it occurred.',
      minimumDerivation,
      refutationFloor,
    });
  }

  const combined = corroborate(winning.map((f) => ({
    derivation: f.derivation,
    status: f.status,
    lineageRoot: f.lineageRoot,
  })));

  // 4. Strength floor. A claimant may refuse to settle on weak provenance.
  if (rankOf(combined.derivation) < rankOf(minimumDerivation)) {
    trace.push({ rule: 'BELOW_MINIMUM_DERIVATION', sourceId: null, effect: 'verdict withheld',
      why: `best available evidence is ${combined.derivation}; the claim requires at least ${minimumDerivation}` });
    return finalise({
      verdict: VERDICT.INDETERMINATE,
      derivation: combined.derivation,
      confidence: combined.confidence,
      trace,
      reason:
        `Evidence exists but its strongest provenance class is ${combined.derivation}, below the ` +
        `${minimumDerivation} floor this claim was filed with. The finding is withheld rather than ` +
        'downgraded silently — the requester asked not to be settled on evidence this weak.',
      minimumDerivation,
      refutationFloor,
      withheldVerdict: positives.length > 0 ? VERDICT.SUPPORTED : VERDICT.REFUTED,
    });
  }

  const verdict = positives.length > 0 ? VERDICT.SUPPORTED : VERDICT.REFUTED;
  trace.push({ rule: 'DECIDED', sourceId: null, effect: verdict,
    why: `${combined.independentSources} independent source(s), agreement ${combined.agreement}, ` +
         `strongest provenance ${combined.derivation}` });

  return finalise({
    verdict,
    derivation: combined.derivation,
    confidence: combined.confidence,
    independentSources: combined.independentSources,
    agreement: combined.agreement,
    trace,
    reason: verdict === VERDICT.SUPPORTED
      ? `Affirmed by ${combined.independentSources} independent source(s) at ${combined.derivation} provenance.`
      : `Contradicted by ${combined.independentSources} independent source(s) that demonstrably had the ` +
        `coverage to detect the claimed event (observability ≥ ${refutationFloor}) and did not.`,
    minimumDerivation,
    refutationFloor,
  });
}

function finalise(v) {
  return Object.freeze({
    independentSources: 0,
    agreement: 0,
    withheldVerdict: null,
    ...v,
    /** Plain-language line for the certificate header. */
    headline: HEADLINE[v.verdict],
  });
}

const HEADLINE = Object.freeze({
  SUPPORTED: 'The evidence supports this claim.',
  REFUTED: 'The evidence contradicts this claim, and the sources could have detected it.',
  UNSUPPORTED: 'No supporting evidence was found, but coverage was too weak to deny the claim.',
  INDETERMINATE: 'This claim cannot be decided from the available evidence.',
  BLOCKED: 'This claim could not be evaluated under the declared licence terms.',
});
