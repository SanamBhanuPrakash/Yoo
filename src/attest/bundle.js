/**
 * Evidence bundle — the artefact that has to survive a dispute.
 *
 * A screenshot of a dashboard is not evidence. It has no chain of custody, no
 * statement of the process that produced it, and no way for the other side to
 * check it. This module produces something that does:
 *
 *   - the exact claim, canonically hashed
 *   - every request made, with a SHA-256 of the response body received
 *   - the licence screening, including sources excluded for legal reasons
 *   - the reasoning trace, rule by rule
 *   - a PROCESS CERTIFICATE describing how the record was produced
 *
 * On the response digests: the bundle commits to WHAT WE SAW without
 * republishing it. A verifier who re-fetches the same URL can prove byte
 * identity; we never redistribute an ODbL or proprietary payload we may have
 * no right to redistribute. The cryptography is doing licensing work.
 *
 * On the process certificate: several evidence regimes — India's Bharatiya
 * Sakshya Adhiniyam s.63 among them — admit computer-generated records only
 * alongside a statement about the device and process that produced them. The
 * certificate below is shaped to carry those particulars. Producing the shape
 * is an engineering act; signing the human declaration is a legal one, and the
 * `declarant` field is left for a human because a program cannot swear to it.
 *
 * @module attest/bundle
 */

import { createHash } from 'node:crypto';
import { canonicalise, stripVolatile } from './canonical.js';

export const FORMAT_VERSION = 'sakshya-evidence-bundle/1';

function sha256(text) {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * @param {object} evaluation  the result of engine/evaluate
 * @param {object} [meta]
 * @param {string} [meta.engineVersion]
 * @param {string} [meta.operator]  who ran it
 * @param {object} [meta.declarant] human taking responsibility, if any
 */
export function buildBundle(evaluation, meta = {}) {
  const claimHash = sha256(canonicalise(evaluation.claim));

  // Chain of custody: one row per request actually made.
  const custody = evaluation.findings
    .filter((f) => f.queried)
    .map((f) => ({
      sourceId: f.sourceId,
      requestUrl: f.requestUrl,
      httpStatus: f.httpStatus,
      reachability: f.reachability,
      responseDigest: f.responseDigest,
      contentDigest: f.contentDigest ?? null,
      fetchedAt: f.fetchedAt,
      elapsedMs: f.elapsedMs,
    }));

  const core = {
    formatVersion: FORMAT_VERSION,
    claim: evaluation.claim,
    claimHash,
    verdict: evaluation.verdict,
    findings: evaluation.findings,
    licence: evaluation.licence,
    observability: evaluation.observabilityIndex,
    custody,
  };

  // Reproducibility hash: over the deterministic core only. Two runs against
  // an unchanged upstream produce the same value; a changed upstream produces
  // a different one, which is the point.
  const evidenceHash = sha256(canonicalise(stripVolatile(core)));

  return {
    ...core,
    evidenceHash,
    process: processCertificate({ evaluation, meta }),
    timing: evaluation.timing,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * The statement about HOW this record came to exist. Deliberately written in
 * plain declarative sentences rather than field names, because its audience is
 * an adjuster, an auditor or a judge, not a developer.
 */
function processCertificate({ evaluation, meta }) {
  const sources = evaluation.findings.map((f) => f.title ?? f.sourceId);
  return {
    engine: 'Sakshya evidence engine',
    engineVersion: meta.engineVersion ?? '0.1.0',
    /** Left null unless a human takes responsibility. A program cannot swear. */
    declarant: meta.declarant ?? null,
    operator: meta.operator ?? null,
    statements: [
      'This record was produced by an automated process operating in the ordinary course of its use.',
      `The process queried the following sources: ${sources.join('; ')}.`,
      'For each source, the process recorded the request URL, the HTTP status returned, a SHA-256 ' +
        'digest of the exact response body received, and a separate SHA-256 digest over the ' +
        'normalised records extracted from that response. Response bodies themselves are not ' +
        'reproduced in this record.',
      'The two digests serve different purposes. The response digest fixes exactly what arrived and ' +
        'is expected to drift where a source stamps each reply with a generation time. The content ' +
        'digest fixes what the source said about this claim, and is the value against which ' +
        're-verification is assessed.',
      'Before any request was sent, each source was screened against a recorded summary of its ' +
        'published licence terms for the declared purpose. Sources not cleared for that purpose ' +
        'were not contacted, and are listed in this record as excluded.',
      'Each value carries a derivation class stating whether it was directly observed, computed, ' +
        'modelled, estimated or generated. The process cannot raise a derivation class; it can ' +
        'only preserve or lower it.',
      'Where no source capable of detecting the asserted event was available, the process reports ' +
        'that the claim is undetermined. It does not report the claim as false.',
      'The evidenceHash in this record is a SHA-256 over the canonical form of the claim, verdict, ' +
        'findings, licence screening and chain of custody, excluding wall-clock timings.',
    ],
    limitations: [
      'A verdict is a statement about the available evidence, not a finding of fact.',
      'Licence summaries are structured readings of publicly stated terms as at the recorded ' +
        'verification date. They are not legal advice and terms may have changed.',
      'Modelled and estimated values carry the error characteristics of their models, which this ' +
        'record does not independently quantify.',
      'Re-verification depends on the upstream source continuing to serve the same response. ' +
        'Sources that revise or withdraw records will not reproduce.',
    ],
  };
}

export { sha256 };
