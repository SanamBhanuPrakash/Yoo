/**
 * Independent verifier.
 *
 * Runs three checks that answer three different questions:
 *
 *   INTEGRITY    was the bundle altered since issue?           (offline, ed25519)
 *   CONSISTENCY  does the bundle hash to what it claims?       (offline, recompute)
 *   REPRODUCTION do the sources still report the same thing?   (online, re-run)
 *
 * WHAT REPRODUCTION COMPARES, AND WHY IT IS NOT RAW BYTES
 * ------------------------------------------------------
 * An earlier build of this verifier compared SHA-256 digests of raw response
 * bodies. It failed on its first real test, and the reason is instructive:
 * USGS stamps every GeoJSON response with `metadata.generated`, the current
 * epoch. Two identical queries a second apart therefore differ in bytes while
 * being identical in meaning. A raw-byte verifier cries tampering on every
 * single re-check and catches nothing — an alarm that always fires is worse
 * than no alarm, because people switch it off.
 *
 * So reproduction re-runs the ADAPTER and compares the normalised records:
 * does this source still say the same thing about this claim? Raw drift is
 * still reported, demoted to a note.
 *
 * A genuine content divergence is NOT automatically tampering. USGS revises
 * magnitudes. Models get rerun. Articles get withdrawn. The divergence IS the
 * signal: it is how you discover that the number your payout was computed
 * from no longer exists upstream — precisely what a system that silently
 * re-fetches and overwrites would have hidden from you.
 *
 * @module attest/verify
 */

import { canonicalise, stripVolatile } from './canonical.js';
import { sha256 } from './bundle.js';
import { verifySignature } from './sign.js';
import { httpGetPaced, REACHABILITY, digest } from '../sources/base.js';
import { adapterById } from '../sources/index.js';

export async function verifyBundle(bundle, { reproduce = false } = {}) {
  const checks = [];

  // ---- INTEGRITY -------------------------------------------------------
  const sig = verifySignature(bundle);
  checks.push({
    check: 'INTEGRITY',
    passed: sig.valid,
    detail: sig.reason,
    meaning: 'Whether the bundle has been altered since it was signed.',
  });

  // ---- CONSISTENCY -----------------------------------------------------
  const recomputedClaimHash = sha256(canonicalise(bundle.claim));
  checks.push({
    check: 'CLAIM_HASH',
    passed: recomputedClaimHash === bundle.claimHash,
    detail: recomputedClaimHash === bundle.claimHash
      ? 'claim hash matches'
      : `expected ${bundle.claimHash}, recomputed ${recomputedClaimHash}`,
    meaning: 'Whether the stated claim is the one that was actually evaluated.',
  });

  const core = {
    formatVersion: bundle.formatVersion,
    claim: bundle.claim,
    claimHash: bundle.claimHash,
    verdict: bundle.verdict,
    findings: bundle.findings,
    licence: bundle.licence,
    observability: bundle.observability,
    custody: bundle.custody,
  };
  const recomputedEvidenceHash = sha256(canonicalise(stripVolatile(core)));
  checks.push({
    check: 'EVIDENCE_HASH',
    passed: recomputedEvidenceHash === bundle.evidenceHash,
    detail: recomputedEvidenceHash === bundle.evidenceHash
      ? 'evidence hash matches'
      : `expected ${bundle.evidenceHash}, recomputed ${recomputedEvidenceHash}`,
    meaning: 'Whether the findings and reasoning are the ones that were hashed at issue.',
  });

  // ---- REPRODUCTION ----------------------------------------------------
  const reproductions = [];
  if (reproduce) {
    for (const row of bundle.custody ?? []) {
      if (!row.requestUrl) continue;
      const adapter = adapterById(row.sourceId);

      if (adapter && bundle.claim) {
        reproductions.push(await reproduceViaAdapter(adapter, bundle.claim, row));
        continue;
      }
      reproductions.push(await reproduceViaBytes(row));
    }
    const diverged = reproductions.filter((r) => r.outcome === 'DIVERGED').length;
    const identical = reproductions.filter((r) => r.outcome === 'IDENTICAL').length;
    checks.push({
      check: 'REPRODUCTION',
      passed: diverged === 0,
      detail: `${identical} identical, ${diverged} diverged, ` +
              `${reproductions.length - identical - diverged} not comparable`,
      meaning: 'Whether the sources still report the same findings for this claim. Compared on ' +
               'normalised records, not raw bytes. Divergence may indicate legitimate upstream ' +
               'revision rather than tampering, and is surfaced rather than smoothed over.',
    });
  }

  // Reproduction deliberately does NOT gate `valid`. A source that revised a
  // record months later does not retroactively make a correctly-issued bundle
  // invalid; it makes it a correct record of what was knowable at the time.
  const offlineChecks = checks.filter((c) => c.check !== 'REPRODUCTION');
  return {
    valid: offlineChecks.every((c) => c.passed),
    checks,
    reproductions,
    summary: offlineChecks.every((c) => c.passed)
      ? 'Bundle is internally consistent and unaltered since issue.'
      : 'Bundle FAILED offline verification: ' +
        offlineChecks.filter((c) => !c.passed).map((c) => c.check).join(', '),
  };
}

async function reproduceViaAdapter(adapter, claim, row) {
  let result;
  try {
    result = await adapter.observe(claim);
  } catch (err) {
    return { sourceId: row.sourceId, outcome: 'UNAVAILABLE', detail: `adapter error: ${err.message}` };
  }
  if (result.reachability !== REACHABILITY.ANSWERED) {
    return {
      sourceId: row.sourceId,
      outcome: 'UNAVAILABLE',
      detail: `${result.error ?? `HTTP ${result.httpStatus}`} — neither confirmation nor contradiction`,
    };
  }
  if (row.contentDigest == null) {
    return {
      sourceId: row.sourceId,
      outcome: 'UNCOMPARABLE',
      detail: 'bundle predates content digests; only raw bytes were recorded at issue',
    };
  }

  const nowContent = result.contentDigest ?? null;
  const match = nowContent === row.contentDigest;
  const rawDrifted = Boolean(row.responseDigest && result.body && digest(result.body) !== row.responseDigest);

  return {
    sourceId: row.sourceId,
    outcome: match ? 'IDENTICAL' : 'DIVERGED',
    recordedContentDigest: row.contentDigest,
    currentContentDigest: nowContent,
    rawBytesDrifted: rawDrifted,
    detail: match
      ? 'source still reports the same findings for this claim' +
        (rawDrifted ? ' (raw bytes differ, as this source stamps each reply — expected, harmless)' : '')
      : 'the source now reports DIFFERENT findings for this claim. A record may have been revised, ' +
        'withdrawn or re-analysed upstream. Investigate before treating it as tampering — and note ' +
        'this is exactly the divergence a system that silently re-fetches would have hidden.',
  };
}

async function reproduceViaBytes(row) {
  const res = await httpGetPaced(row.sourceId, row.requestUrl);
  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { sourceId: row.sourceId, outcome: 'UNAVAILABLE', detail: res.error ?? `HTTP ${res.httpStatus}` };
  }
  const now = digest(res.body);
  return {
    sourceId: row.sourceId,
    outcome: now === row.responseDigest ? 'IDENTICAL' : 'DIVERGED',
    recordedDigest: row.responseDigest,
    currentDigest: now,
    detail: 'raw-byte comparison only; no adapter registered for this source',
  };
}
