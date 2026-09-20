/**
 * Evaluation orchestrator.
 *
 * ORDER OF OPERATIONS IS THE PRODUCT
 * ----------------------------------
 *   1. licence screening   — BEFORE any network call
 *   2. observability       — BEFORE trusting any answer
 *   3. fetch               — only from cleared, capable sources
 *   4. staleness demotion  — applied to what came back
 *   5. verdict             — with refutation held to a higher bar than support
 *
 * Step 1 running first is not a nicety. Under several of these terms, querying
 * at commercial scale is itself the breach, so a system that fetches and then
 * filters has already done the thing it was trying to avoid.
 *
 * @module engine/evaluate
 */

import { screenSources, obligationsFor, shareAlikeWarning } from '../license/policy.js';
import { adaptersFor } from '../sources/index.js';
import { applyStaleness, STATUS, DERIVATION, TEMPORALITY } from '../provenance/lattice.js';
import { decide, VERDICT, REFUTATION_FLOOR } from './verdict.js';
import { normaliseClaim } from './claim.js';

/**
 * @param {object} rawClaim
 * @param {object} [options]
 * @param {number} [options.refutationFloor]
 * @param {Function} [options.now] injectable clock for deterministic tests
 */
export async function evaluate(rawClaim, options = {}) {
  const claim = normaliseClaim(rawClaim);
  const now = options.now ?? (() => Date.now());
  const startedAt = new Date(now()).toISOString();
  const refutationFloor = options.refutationFloor ?? REFUTATION_FLOOR;

  // ---- 1. Which adapters even claim to answer this kind of assertion? -----
  const candidates = adaptersFor(claim.assertion.kind);

  // ---- 2. Licence screening, before a single packet leaves the machine ----
  const screening = screenSources(candidates.map((a) => a.id), claim.intendedUse);
  const permittedIds = new Set(screening.permitted.map((s) => s.sourceId));
  const cleared = candidates.filter((a) => permittedIds.has(a.id));

  if (cleared.length === 0) {
    return assemble({
      claim, startedAt, now, screening, findings: [], refutationFloor,
      verdict: {
        verdict: VERDICT.BLOCKED,
        derivation: DERIVATION.SIMULATED,
        confidence: 0,
        headline: 'This claim could not be evaluated under the declared licence terms.',
        reason:
          `Every source capable of answering this claim is excluded for ${claim.intendedUse} use: ` +
          screening.excluded.map((e) => `${e.sourceId} (${e.license})`).join(', ') +
          '. No request was sent. Re-file under a permitted use, or licence the data.',
        trace: screening.excluded.map((e) => ({
          rule: 'LICENCE_EXCLUDED', sourceId: e.sourceId, effect: 'not queried', why: e.reason,
        })),
        independentSources: 0, agreement: 0, withheldVerdict: null,
        minimumDerivation: claim.minimumDerivation, refutationFloor,
      },
    });
  }

  // ---- 3. Observability first, then fetch only what could answer ---------
  const findings = [];
  for (const adapter of cleared) {
    const observability = adapter.observability(claim);

    // A source with a hard zero is not contacted. Saves quota, and records the
    // reason, which is more useful than an empty result would have been.
    if (!observability.observable) {
      findings.push({
        sourceId: adapter.id, lineageRoot: adapter.lineageRoot, title: adapter.title,
        derivation: adapter.derivation, status: STATUS.INDETERMINATE,
        observability, corroborationOnly: Boolean(adapter.corroborationOnly),
        queried: false,
        unavailableReason: `not queried: ${observability.blockers.join(', ')} blocked observability`,
        evidence: null, provenanceChain: [],
      });
      continue;
    }

    const result = await adapter.observe(claim);

    // ---- 4. Staleness demotion -----------------------------------------
    const observedAt = firstTimestamp(result) ?? result.fetchedAt;
    const ageSeconds = Math.max(0, (now() - Date.parse(observedAt)) / 1000);
    const staleness = applyStaleness({
      derivation: adapter.derivation,
      ageSeconds,
      validSeconds: adapter.validSeconds,
      temporality: adapter.temporality ?? TEMPORALITY.STATE,
    });

    // USGS publishes its own review status; an automatic solution has not been
    // checked by a human and is demoted one step accordingly.
    let derivation = staleness.derivation;
    const chain = [{ step: 'source', derivation: adapter.derivation, why: `${adapter.title} publishes at ${adapter.derivation} class` }];
    if (staleness.demotedBy) {
      chain.push({ step: 'staleness', derivation: staleness.derivation,
        why: `observation is ${Math.round(ageSeconds)}s old against a ${adapter.validSeconds}s validity window` });
    }
    if (result.allReviewed === false) {
      derivation = DERIVATION.MODELED;
      chain.push({ step: 'review-status', derivation,
        why: 'at least one matching solution is automatic, not human-reviewed' });
    }

    findings.push({
      sourceId: adapter.id, lineageRoot: adapter.lineageRoot, title: adapter.title,
      derivation, status: result.status, observability,
      corroborationOnly: Boolean(adapter.corroborationOnly),
      queried: true,
      unavailableReason: result.status === STATUS.INDETERMINATE
        ? (result.error ?? `source ${result.reachability}`) : null,
      reachability: result.reachability,
      httpStatus: result.httpStatus ?? null,
      requestUrl: result.url,
      responseDigest: result.bodyDigest,
      contentDigest: result.contentDigest ?? null,
      fetchedAt: result.fetchedAt,
      elapsedMs: result.elapsedMs ?? null,
      retried: Boolean(result.retried),
      provenanceChain: chain,
      evidence: summariseEvidence(result),
    });
  }

  // ---- 5. Verdict --------------------------------------------------------
  const verdict = decide({ findings, minimumDerivation: claim.minimumDerivation, refutationFloor });
  return assemble({ claim, startedAt, now, screening, findings, verdict, refutationFloor });
}

function firstTimestamp(result) {
  const rec = result.matched?.[0] ?? result.records?.[0];
  return rec?.time ?? rec?.peakHourAt ?? null;
}

/** Keep the shape small and uniform; full payloads stay upstream, only hashed. */
function summariseEvidence(result) {
  return {
    matched: result.matched?.length ?? (result.status === STATUS.POSITIVE ? result.records?.length ?? 0 : 0),
    nearMisses: result.nearMisses?.length ?? 0,
    records: (result.matched ?? result.records ?? []).slice(0, 5),
    nearMissRecords: (result.nearMisses ?? []).slice(0, 3),
    distinctDomains: result.distinctDomains,
    note: result.note ?? null,
  };
}

function assemble({ claim, startedAt, now, screening, findings, verdict, refutationFloor }) {
  const contributing = findings.filter((f) => f.queried && f.status !== STATUS.INDETERMINATE).map((f) => f.sourceId);
  return {
    claim,
    verdict,
    findings,
    licence: {
      intendedUse: claim.intendedUse,
      permitted: screening.permitted,
      excluded: screening.excluded,
      obligations: obligationsFor(contributing),
      shareAlike: shareAlikeWarning(contributing),
    },
    /**
     * Aggregate observability across all sources. This is the number that, at
     * scale, becomes its own product: a map of where on Earth claims can and
     * cannot be verified. Blind spots are where fraud is cheapest and where
     * insurance is least priceable, and nobody currently sells that map.
     */
    observabilityIndex: aggregateObservability(findings),
    timing: { startedAt, finishedAt: new Date(now()).toISOString() },
  };
}

function aggregateObservability(findings) {
  if (findings.length === 0) return { index: 0, best: 0, perSource: [] };
  const perSource = findings.map((f) => ({
    sourceId: f.sourceId, index: f.observability.index, blockers: f.observability.blockers,
  }));
  // Aggregate as the BEST single source, not the mean: one source with full
  // coverage makes a claim observable regardless of how many blind ones exist.
  const best = Math.max(...perSource.map((p) => p.index));
  return { index: best, best, perSource };
}

export { VERDICT };
