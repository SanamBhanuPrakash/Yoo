/**
 * License gate — the enforcement half of the registry.
 *
 * The engine calls `screenSources()` BEFORE any network request is made, and
 * `assertClearance()` before a bundle is sealed. A source whose licence does
 * not permit the declared use is never contacted at all, which matters: in
 * some terms the mere act of querying at commercial scale is the violation.
 *
 * @module license/policy
 */

import { licenseFor, USE, USE_RANK, OBLIGATION } from './registry.js';

export class LicenseViolation extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'LicenseViolation';
    this.details = details;
  }
}

/**
 * Does `sourceId` permit `intendedUse`?
 * @returns {{allowed: boolean, sourceId: string, license: string, maxUse: string, reason: string, obligations: string[], attribution: string}}
 */
export function screenSource(sourceId, intendedUse) {
  const fact = licenseFor(sourceId);
  if (USE_RANK[intendedUse] === undefined) {
    throw new TypeError(`unknown intended use: ${String(intendedUse)}`);
  }
  const allowed = USE_RANK[fact.maxUse] >= USE_RANK[intendedUse];
  return {
    allowed,
    sourceId,
    license: fact.license,
    maxUse: fact.maxUse,
    attribution: fact.attribution,
    obligations: fact.obligations,
    licenseUrl: fact.licenseUrl,
    verifiedOn: fact.verifiedOn,
    reason: allowed
      ? `${fact.license} permits ${intendedUse}.`
      : `${fact.license} permits at most ${fact.maxUse}; ${intendedUse} was requested. ${fact.note}`,
  };
}

/**
 * Partition a set of sources into those usable for the declared purpose and
 * those that must be excluded. The excluded set is NOT an error — it is
 * reportable content that belongs on the certificate, so the reader can see
 * which evidence was legally unavailable rather than merely absent.
 *
 * This distinction is unusual and it matters: "we did not check OpenSky"
 * and "we were not permitted to check OpenSky" are different facts about
 * the strength of a verdict.
 */
export function screenSources(sourceIds, intendedUse) {
  const screened = sourceIds.map((id) => screenSource(id, intendedUse));
  return {
    intendedUse,
    permitted: screened.filter((s) => s.allowed),
    excluded: screened.filter((s) => !s.allowed),
  };
}

/**
 * Collect every obligation triggered by the sources actually used. These are
 * printed on the certificate as a compliance checklist, because an attribution
 * obligation discharged nowhere is an attribution obligation breached.
 */
export function obligationsFor(sourceIds) {
  const out = new Map();
  for (const id of sourceIds) {
    const fact = licenseFor(id);
    for (const ob of fact.obligations) {
      if (!out.has(ob)) out.set(ob, []);
      out.get(ob).push({ sourceId: id, attribution: fact.attribution, licenseUrl: fact.licenseUrl });
    }
  }
  return Object.fromEntries([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Hard gate. Throws if any source that actually contributed evidence is not
 * cleared for the declared use. Called at seal time so that no signed bundle
 * can exist in violation.
 */
export function assertClearance(contributingSourceIds, intendedUse) {
  const { excluded } = screenSources(contributingSourceIds, intendedUse);
  if (excluded.length > 0) {
    throw new LicenseViolation(
      `Cannot seal a ${intendedUse} attestation: ` +
        excluded.map((e) => `${e.sourceId} (${e.license}, max ${e.maxUse})`).join(', '),
      { intendedUse, excluded },
    );
  }
  return true;
}

/**
 * Share-alike is the obligation people discover in a deposition. ODbL attaches
 * to derived *databases*; an attestation that embeds substantial extracted
 * geometry may itself be a derived database. We flag it rather than decide it,
 * and we say so in exactly those words on the certificate.
 */
export function shareAlikeWarning(sourceIds) {
  const triggering = sourceIds.filter((id) =>
    licenseFor(id).obligations.includes(OBLIGATION.SHARE_ALIKE_DATABASE));
  if (triggering.length === 0) return null;
  return {
    sources: triggering,
    warning:
      'One or more sources carry database share-alike terms (ODbL). Extracting a substantial ' +
      'portion of these into a stored, queryable dataset may create a Derivative Database that ' +
      'must itself be offered under the same licence. Using a single resolved value as context ' +
      'generally does not. Which side of that line a deployment sits on is a legal question, ' +
      'not an engineering one — this is a flag, not a determination.',
  };
}

export { USE, OBLIGATION };
