/**
 * GDELT DOC 2.0 — open news corroboration.
 *
 * WHAT THIS SOURCE ACTUALLY OBSERVES
 * ----------------------------------
 * GDELT observes ARTICLES. It does not observe floods, fires or earthquakes.
 * The existence of an article is an OBSERVED fact; the physical event the
 * article describes is, from this adapter's seat, an ESTIMATED proxy — a
 * claim about a claim.
 *
 * This is not pedantry, it is the entire reason media-monitoring pipelines
 * mislead. Reporting volume tracks newsworthiness, press density and language
 * coverage, none of which are the event. A disaster in a district with no
 * local press produces silence, and silence read as a negative is how
 * underserved regions get systematically under-compensated.
 *
 * So this adapter is wired as CORROBORATION ONLY. The engine will accept it
 * as supporting weight for a positive, and will NEVER let it establish a
 * negative on its own — enforced in engine/evaluate.js, not merely documented.
 *
 * Storage note: only URL, domain, title, language and timestamp are retained.
 * Article bodies remain the publishers' and are never copied into a bundle.
 *
 * @module sources/gdelt
 */

import { REACHABILITY, FACTOR, envelope, httpGetPaced, contentDigest } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'gdelt';
export const lineageRoot = 'gdelt';
export const title = 'GDELT DOC 2.0 open news index';
/** A proxy for the event, not the event. Capped here, permanently. */
export const derivation = DERIVATION.ESTIMATED;
/** An article published at time T remains published. */
export const temporality = TEMPORALITY.EVENT;
export const validSeconds = 900;
/** Enforced by the engine: may support a POSITIVE, may never carry a NEGATIVE. */
export const corroborationOnly = true;

/** GDELT's rolling index does not reach far back through this endpoint. */
const MAX_LOOKBACK_DAYS = 365;

export function supports(assertionKind) {
  return assertionKind === 'PUBLIC_REPORTING' || assertionKind === 'SEISMIC_EVENT' ||
         assertionKind === 'RAINFALL_EXCEEDED';
}

export function observability(claim) {
  const startMs = Date.parse(claim.window.start);
  const daysBack = (Date.now() - startMs) / 86_400_000;
  const temporal = daysBack <= MAX_LOOKBACK_DAYS ? 1 : 0;

  // Press-density proxy. Honest about being a proxy: we cannot measure local
  // media coverage from here, so we report the factor as UNKNOWN-leaning
  // rather than inventing a number per country.
  const pressDensity = 0.6;

  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: pressDensity, reason:
        'Coverage depends on local press density and indexed languages, which this adapter cannot measure. ' +
        'Scored conservatively: absence of reporting is NOT evidence of absence of the event.' },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: temporal, reason: temporal
        ? `Window starts ${daysBack.toFixed(0)} d ago, within the rolling index.`
        : `Window starts ${daysBack.toFixed(0)} d ago, beyond this endpoint's rolling index.` },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: 0.5, reason:
        'Newsworthiness threshold is unknown and varies by region and event type.' },
    { factor: FACTOR.LATENCY, score: 1, reason: 'Index updates continuously.' },
  ]);
}

function gdeltStamp(iso) {
  // GDELT wants YYYYMMDDHHMMSS.
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
}

export async function observe(claim) {
  const terms = claim.assertion.reportingTerms ?? [];
  const place = claim.subject.label ?? '';
  const query = [place, ...terms].filter(Boolean).map((t) => `"${t}"`).join(' ');
  if (!query) {
    return {
      sourceId: id, url: null, fetchedAt: new Date().toISOString(),
      reachability: REACHABILITY.NOT_QUERIED, httpStatus: null, bodyDigest: null, body: null,
      status: STATUS.INDETERMINATE, records: [],
      error: 'no place label or reporting terms supplied — not queried',
    };
  }

  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: '25',
    format: 'json',
    startdatetime: gdeltStamp(claim.window.start),
    enddatetime: gdeltStamp(claim.window.end),
    sort: 'datedesc',
  });
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
  const res = await httpGetPaced(id, url);

  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    // GDELT returns HTML on some error paths. Unparseable is INDETERMINATE.
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], error: 'unparseable response' };
  }

  const records = (parsed.articles ?? []).map((a) => ({
    url: a.url,
    domain: a.domain,
    title: a.title,
    language: a.language,
    sourceCountry: a.sourcecountry,
    seenAt: a.seendate,
  }));

  // Distinct domains matter more than article count: fifty syndications of one
  // wire story are one source, not fifty.
  const distinctDomains = new Set(records.map((r) => r.domain).filter(Boolean)).size;

  return {
    ...res,
    sourceId: id,
    contentDigest: contentDigest(records),
    // NEGATIVE is deliberately never emitted. Silence in the press index is
    // INDETERMINATE by construction — the whole point of this adapter.
    status: records.length > 0 ? STATUS.POSITIVE : STATUS.INDETERMINATE,
    records: records.slice(0, 25),
    distinctDomains,
    query,
    note: records.length === 0
      ? 'No indexed reporting found. Recorded as INDETERMINATE, not NEGATIVE: press silence is not event absence.'
      : `${records.length} articles across ${distinctDomains} distinct domains.`,
  };
}
