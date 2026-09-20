/**
 * OpenSky Network — registered, implemented, and deliberately unusable
 * commercially.
 *
 * WHY A WORKING ADAPTER NOBODY CAN SHIP
 * -------------------------------------
 * OpenSky is the backbone of nearly every hobby flight-tracking project,
 * God's Eye View's primary flight layer included. Its terms are research and
 * education only; operational or commercial use needs written permission.
 *
 * The trap this exists to spring: an MIT-licensed repository does NOT
 * relicense the feeds it calls. Fork a permissively-licensed globe, point it
 * at OpenSky, charge money, and you have a licence problem that no amount of
 * clean git history fixes. That sentence is in a README somewhere and gets
 * read by roughly nobody.
 *
 * So the adapter is fully wired, and the licence gate refuses it for any
 * commercial use before a single packet leaves the machine. The refusal is
 * the feature. It is what "compliance you cannot forget to do" means in
 * practice, and it is the cheapest possible way to learn the constraint.
 *
 * @module sources/opensky
 */

import { REACHABILITY, FACTOR, envelope, httpGetPaced, contentDigest, haversineKm } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'opensky';
export const lineageRoot = 'opensky';
export const title = 'OpenSky Network live state vectors (ADS-B)';
export const derivation = DERIVATION.OBSERVED;
/** A state vector describes an aircraft NOW, so it decays hard. */
export const temporality = TEMPORALITY.STATE;
export const validSeconds = 30;

export function supports(assertionKind) {
  return assertionKind === 'AIRCRAFT_PRESENCE';
}

export function observability(claim) {
  const endMs = Date.parse(claim.window.end);
  const ageSeconds = (Date.now() - endMs) / 1000;

  // The anonymous endpoint serves only the current snapshot. A historical
  // window is simply not answerable here, and saying so is more useful than
  // returning an empty array that reads as "no aircraft".
  const temporal = ageSeconds <= validSeconds ? 1 : 0;

  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: 0.7, reason:
        'Coverage follows the volunteer receiver network: dense over Europe and North America, ' +
        'sparse over oceans, deserts and much of the global South.' },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: temporal, reason: temporal
        ? 'Window is the live snapshot.'
        : `Window closed ${Math.round(ageSeconds)}s ago; the anonymous endpoint serves only current state, ` +
          'so this source could not have observed the requested period.' },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: 0.8, reason:
        'Requires a functioning ADS-B transponder. Aircraft not transmitting are invisible, ' +
        'which is precisely the population most surveillance questions are about.' },
    { factor: FACTOR.LATENCY, score: 1, reason: 'State vectors are near-real-time.' },
  ]);
}

export async function observe(claim) {
  const { lat, lon, radiusKm } = claim.subject;
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const params = new URLSearchParams({
    lamin: String(lat - dLat), lamax: String(lat + dLat),
    lomin: String(lon - dLon), lomax: String(lon + dLon),
  });
  const url = `https://opensky-network.org/api/states/all?${params}`;
  const res = await httpGetPaced(id, url);

  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [] };
  }
  let parsed;
  try { parsed = JSON.parse(res.body); } catch {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], error: 'unparseable JSON' };
  }

  const records = (parsed.states ?? []).map((s) => ({
    icao24: s[0], callsign: (s[1] ?? '').trim() || null, originCountry: s[2],
    lon: s[5], lat: s[6], baroAltitudeM: s[7], onGround: s[8], velocityMps: s[9],
    lastContact: s[4] ? new Date(s[4] * 1000).toISOString() : null,
    distanceKm: s[6] == null ? null : Number(haversineKm({ lat, lon }, { lat: s[6], lon: s[5] }).toFixed(2)),
  })).filter((r) => r.distanceKm != null && r.distanceKm <= radiusKm);

  return {
    ...res, sourceId: id,
    contentDigest: contentDigest(records),
    status: records.length > 0 ? STATUS.POSITIVE : STATUS.NEGATIVE,
    records: records.slice(0, 25),
  };
}
