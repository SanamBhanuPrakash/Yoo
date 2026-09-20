/**
 * USGS ComCat earthquake catalog.
 *
 * The cleanest source in the registry: US federal public domain, global,
 * retrospective, and authoritative. Used as the reference implementation of
 * a well-behaved adapter.
 *
 * THE DETAIL THAT MATTERS: the catalog's magnitude of completeness is NOT
 * global. Inside dense US networks it is roughly M2.5; across much of the
 * world it is closer to M4.5, and below that threshold "no event in the
 * catalog" is not evidence of no event — it is evidence of no instrument.
 * The adapter therefore refuses to return a clean NEGATIVE for a small-
 * magnitude claim in a sparsely instrumented region, and says why.
 *
 * @module sources/usgs
 */

import { REACHABILITY, FACTOR, envelope, httpGetPaced, contentDigest, haversineKm } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'usgs-earthquakes';
export const lineageRoot = 'usgs';
export const title = 'USGS Earthquake Catalog (ComCat)';
/** What the publisher itself measures: instrument-derived event parameters. */
export const derivation = DERIVATION.OBSERVED;
/** Reviewed solutions settle within roughly this long; see LATENCY below. */
/** A catalogued earthquake is a timestamped occurrence, not a running state. */
export const temporality = TEMPORALITY.EVENT;
export const validSeconds = 3600;

/**
 * Regions with dense seismic instrumentation, where completeness is far better.
 * Coarse on purpose: a bounding box that over-claims completeness would be
 * worse than one that under-claims it, so these are drawn conservatively.
 */
const DENSE_NETWORKS = [
  { name: 'Conterminous US', minLat: 24, maxLat: 50, minLon: -125, maxLon: -66, mc: 2.5 },
  { name: 'Alaska', minLat: 51, maxLat: 72, minLon: -170, maxLon: -129, mc: 3.0 },
  { name: 'Japan', minLat: 30, maxLat: 46, minLon: 129, maxLon: 146, mc: 3.0 },
  { name: 'Europe (central/south)', minLat: 35, maxLat: 60, minLon: -10, maxLon: 30, mc: 3.2 },
  { name: 'New Zealand', minLat: -48, maxLat: -34, minLon: 166, maxLon: 179, mc: 3.0 },
];
/** Global catalog completeness outside dense networks. */
const GLOBAL_MC = 4.5;

function completenessFor(lat, lon) {
  for (const r of DENSE_NETWORKS) {
    if (lat >= r.minLat && lat <= r.maxLat && lon >= r.minLon && lon <= r.maxLon) {
      return { mc: r.mc, region: r.name };
    }
  }
  return { mc: GLOBAL_MC, region: 'global (sparse network)' };
}

/**
 * Could USGS have seen this claim?
 * @param {object} claim
 */
export function observability(claim) {
  const { lat, lon } = claim.subject;
  const { mc, region } = completenessFor(lat, lon);
  const claimedMag = claim.assertion.minMagnitude ?? 0;

  // Sensitivity: a claim at or above the completeness threshold is fully
  // observable. Below it, observability falls off rather than snapping to
  // zero, because sub-Mc events ARE sometimes catalogued — just not reliably.
  let sensitivity;
  let sensitivityReason;
  if (claimedMag >= mc) {
    sensitivity = 1;
    sensitivityReason = `M${claimedMag} is at or above the ~M${mc} completeness threshold for ${region}.`;
  } else {
    const shortfall = mc - claimedMag;
    sensitivity = Math.max(0, 1 - shortfall / 2);
    sensitivityReason =
      `M${claimedMag} is BELOW the ~M${mc} completeness threshold for ${region}. ` +
      `Absence from the catalog is weak evidence of absence at this magnitude.`;
  }

  // Latency: reviewed magnitudes settle over ~1h. A window ending seconds ago
  // may be covered only by automatic solutions.
  const endMs = Date.parse(claim.window.end);
  const ageMin = (Date.now() - endMs) / 60000;
  const latency = ageMin >= 60 ? 1 : ageMin <= 0 ? 0.3 : 0.3 + 0.7 * (ageMin / 60);
  const latencyReason =
    ageMin >= 60
      ? 'Window closed over an hour ago; reviewed solutions are expected to be published.'
      : `Window closed ${Math.max(0, ageMin).toFixed(0)} min ago; some solutions may still be automatic and subject to revision.`;

  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: 1, reason: 'ComCat is a global catalog.' },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: 1, reason: 'Catalog is fully retrospective; no revisit gap.' },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: sensitivity, reason: sensitivityReason },
    { factor: FACTOR.LATENCY, score: latency, reason: latencyReason },
  ]);
}

export function supports(assertionKind) {
  return assertionKind === 'SEISMIC_EVENT';
}

/**
 * Query the catalog for the claim's space-time box.
 */
export async function observe(claim) {
  const { lat, lon, radiusKm } = claim.subject;
  const minMag = claim.assertion.minMagnitude ?? 0;
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: claim.window.start,
    endtime: claim.window.end,
    latitude: String(lat),
    longitude: String(lon),
    maxradiuskm: String(radiusKm),
    orderby: 'magnitude',
    limit: '50',
  });
  // Query one full magnitude below the claim so we can SHOW near-misses.
  // A verdict that says "nothing at M5.0" is far more credible when it can
  // add "but here is the M4.6 that did occur 30 km away".
  params.set('minmagnitude', String(Math.max(0, minMag - 1)));

  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
  const res = await httpGetPaced(id, url);

  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], matched: [], nearMisses: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], matched: [], nearMisses: [],
      error: 'unparseable GeoJSON' };
  }

  const records = (parsed.features ?? []).map((f) => {
    const [elon, elat, depthKm] = f.geometry?.coordinates ?? [null, null, null];
    return {
      eventId: f.id,
      magnitude: f.properties?.mag ?? null,
      magnitudeType: f.properties?.magType ?? null,
      place: f.properties?.place ?? null,
      time: f.properties?.time ? new Date(f.properties.time).toISOString() : null,
      lat: elat, lon: elon, depthKm,
      distanceKm: elat == null ? null : Number(haversineKm({ lat, lon }, { lat: elat, lon: elon }).toFixed(2)),
      // 'reviewed' vs 'automatic' is the provenance signal USGS itself publishes.
      reviewStatus: f.properties?.status ?? null,
      url: f.properties?.url ?? null,
    };
  });

  const matched = records.filter((r) => (r.magnitude ?? -Infinity) >= minMag);
  const nearMisses = records.filter((r) => (r.magnitude ?? -Infinity) < minMag);

  return {
    ...res,
    sourceId: id,
    contentDigest: contentDigest(records),
    status: matched.length > 0 ? STATUS.POSITIVE : STATUS.NEGATIVE,
    records,
    matched,
    nearMisses,
    // An automatic solution is not yet a reviewed one; the engine demotes on this.
    allReviewed: matched.every((r) => r.reviewStatus === 'reviewed'),
  };
}
