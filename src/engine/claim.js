/**
 * Claim specification — the unit of work.
 *
 * A claim is a falsifiable statement about the physical world, bound to a
 * place, a time window and a threshold. Everything Sakshya does is: take one
 * of these, and return a defensible verdict plus the reasoning.
 *
 * The grammar is deliberately narrow. A claim you cannot state precisely is a
 * claim you cannot verify, and the discipline of forcing a threshold and a
 * window up front is most of the value. "Was there flooding?" is unanswerable.
 * "Did cumulative rainfall within 10 km of 19.0760N 72.8777E exceed 100 mm
 * between 5 and 12 August?" is answerable, arguable, and settleable.
 *
 * @module engine/claim
 */

import { USE } from '../license/registry.js';
import { DERIVATION, rankOf } from '../provenance/lattice.js';

export const ASSERTION = Object.freeze({
  /** An earthquake of at least minMagnitude occurred in the space-time box. */
  SEISMIC_EVENT: 'SEISMIC_EVENT',
  /** Cumulative precipitation at the subject point exceeded thresholdMm. */
  RAINFALL_EXCEEDED: 'RAINFALL_EXCEEDED',
  /** The event was reported in open news. Corroborative by nature. */
  PUBLIC_REPORTING: 'PUBLIC_REPORTING',
  /** An aircraft was present in the space-time box. Only served by a non-commercial source. */
  AIRCRAFT_PRESENCE: 'AIRCRAFT_PRESENCE',
});

export class InvalidClaim extends Error {
  constructor(message) { super(message); this.name = 'InvalidClaim'; }
}

/**
 * Validate and normalise a claim. Normalisation matters for reproducibility:
 * two logically identical claims must hash identically, so timestamps are
 * canonicalised to UTC ISO-8601 with second precision and numbers are coerced.
 */
export function normaliseClaim(input) {
  if (!input || typeof input !== 'object') throw new InvalidClaim('claim must be an object');

  const subject = input.subject ?? {};
  const lat = Number(subject.lat);
  const lon = Number(subject.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new InvalidClaim(`subject.lat out of range: ${subject.lat}`);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new InvalidClaim(`subject.lon out of range: ${subject.lon}`);
  const radiusKm = Number(subject.radiusKm ?? 10);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 2000) {
    throw new InvalidClaim(`subject.radiusKm must be within (0, 2000]: ${subject.radiusKm}`);
  }

  const window = input.window ?? {};
  const start = toIsoSeconds(window.start, 'window.start');
  const end = toIsoSeconds(window.end, 'window.end');
  if (Date.parse(end) <= Date.parse(start)) throw new InvalidClaim('window.end must be after window.start');

  const assertion = input.assertion ?? {};
  const kind = assertion.kind;
  if (!ASSERTION[kind]) throw new InvalidClaim(`unknown assertion.kind: ${String(kind)}`);

  if (kind === ASSERTION.SEISMIC_EVENT && !Number.isFinite(Number(assertion.minMagnitude))) {
    throw new InvalidClaim('SEISMIC_EVENT requires a numeric assertion.minMagnitude');
  }
  if (kind === ASSERTION.RAINFALL_EXCEEDED && !Number.isFinite(Number(assertion.thresholdMm))) {
    throw new InvalidClaim('RAINFALL_EXCEEDED requires a numeric assertion.thresholdMm');
  }

  const intendedUse = input.intendedUse ?? USE.NONCOMMERCIAL;
  if (!USE[intendedUse]) throw new InvalidClaim(`unknown intendedUse: ${String(intendedUse)}`);

  // The strength floor. A claimant may demand that a verdict rest on nothing
  // weaker than, say, DERIVED — the contractual equivalent of "I will not pay
  // out on a model". Defaults to ESTIMATED so the engine is permissive unless
  // told to be strict.
  const minimumDerivation = input.minimumDerivation ?? DERIVATION.ESTIMATED;
  rankOf(minimumDerivation); // throws on nonsense

  return Object.freeze({
    statement: input.statement ?? describeClaim({ subject: { lat, lon, radiusKm, label: subject.label }, window: { start, end }, assertion }),
    subject: Object.freeze({ lat: round6(lat), lon: round6(lon), radiusKm, label: subject.label ?? null }),
    window: Object.freeze({ start, end }),
    assertion: Object.freeze({
      kind,
      minMagnitude: assertion.minMagnitude !== undefined ? Number(assertion.minMagnitude) : undefined,
      thresholdMm: assertion.thresholdMm !== undefined ? Number(assertion.thresholdMm) : undefined,
      precipitationRegime: assertion.precipitationRegime ?? undefined,
      reportingTerms: Object.freeze([...(assertion.reportingTerms ?? [])]),
    }),
    intendedUse,
    minimumDerivation,
    /** Free-form, carried through to the certificate. Never used in reasoning. */
    reference: input.reference ?? null,
  });
}

function toIsoSeconds(value, field) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new InvalidClaim(`${field} is not a parseable timestamp: ${String(value)}`);
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }

/** Render a claim as the English sentence it is asserting. */
export function describeClaim({ subject, window, assertion }) {
  const where = subject.label
    ? `${subject.label} (within ${subject.radiusKm} km of ${fmt(subject.lat)}, ${fmt(subject.lon)})`
    : `within ${subject.radiusKm} km of ${fmt(subject.lat)}, ${fmt(subject.lon)}`;
  const when = `between ${window.start} and ${window.end}`;
  switch (assertion.kind) {
    case ASSERTION.SEISMIC_EVENT:
      return `An earthquake of magnitude ${assertion.minMagnitude} or greater occurred at ${where}, ${when}.`;
    case ASSERTION.RAINFALL_EXCEEDED:
      return `Cumulative precipitation at ${where} exceeded ${assertion.thresholdMm} mm, ${when}.`;
    case ASSERTION.AIRCRAFT_PRESENCE:
      return `At least one transponder-equipped aircraft was present at ${where}, ${when}.`;
    case ASSERTION.PUBLIC_REPORTING:
      return `The event described by [${(assertion.reportingTerms ?? []).join(', ')}] was publicly reported at ${where}, ${when}.`;
    default:
      return `Unrecognised assertion at ${where}, ${when}.`;
  }
}

function fmt(n) {
  return `${Math.abs(n).toFixed(4)}°${n >= 0 ? '' : '-'}`.replace('°-', '° (neg)');
}
