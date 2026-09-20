/**
 * Open-Meteo precipitation — the parametric-insurance primitive.
 *
 * THE MOST IMPORTANT HONEST CALL IN THIS REPOSITORY
 * -------------------------------------------------
 * This source is NOT a rain gauge. Open-Meteo serves numerical weather model
 * output and ERA5-family reanalysis. Reanalysis is a physical model nudged by
 * assimilated observations — superb, peer-reviewed, and still a MODEL. Every
 * value it returns is therefore MODELED, never OBSERVED, no matter how
 * authoritative the number looks in a JSON field called "precipitation_sum".
 *
 * Why this is worth being pedantic about: parametric weather insurance pays
 * out on a threshold, and basis risk — the gap between the gridded number and
 * what actually fell on the farmer's field — is the single largest source of
 * dispute in the entire product line. A convective cell can dump 90 mm on one
 * village and 4 mm on the next, inside one grid cell. A system that reports
 * the cell mean as an observation is not measuring rainfall; it is laundering
 * a model into a payout decision.
 *
 * So this adapter does three things nobody's dashboard does:
 *   1. declares MODELED, permanently, and refuses to be talked out of it;
 *   2. scores SPATIAL REPRESENTATIVENESS from the grid resolution against the
 *      convective character of the precipitation, and degrades the envelope;
 *   3. reports the grid cell's actual distance from the requested point, which
 *      Open-Meteo helpfully returns and almost every integration discards.
 *
 * @module sources/openMeteo
 */

import { REACHABILITY, FACTOR, envelope, httpGetPaced, contentDigest, haversineKm } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'open-meteo';
export const lineageRoot = 'open-meteo';
export const title = 'Open-Meteo precipitation (numerical model / reanalysis)';
/** Permanent. A model output is not an observation, at any resolution. */
export const derivation = DERIVATION.MODELED;
/** Accumulated precipitation over a closed past window is a settled quantity. */
export const temporality = TEMPORALITY.EVENT;
export const validSeconds = 3600;

/** How far back the forecast endpoint will serve past days. */
const MAX_PAST_DAYS = 92;

/**
 * Nominal grid spacing in km for the blended model Open-Meteo serves.
 * Used to score how well a grid mean can represent a point claim.
 */
const NOMINAL_GRID_KM = 11;

export function supports(assertionKind) {
  return assertionKind === 'RAINFALL_EXCEEDED';
}

export function observability(claim) {
  const startMs = Date.parse(claim.window.start);
  const endMs = Date.parse(claim.window.end);
  const daysBack = (Date.now() - startMs) / 86_400_000;

  // Temporal: the forecast endpoint serves a bounded past window. Beyond it,
  // this adapter genuinely cannot answer and must not pretend otherwise.
  let temporal;
  let temporalReason;
  if (daysBack <= MAX_PAST_DAYS) {
    temporal = 1;
    temporalReason = `Window starts ${daysBack.toFixed(0)} d ago, inside the ${MAX_PAST_DAYS}-day past-data horizon.`;
  } else {
    temporal = 0;
    temporalReason =
      `Window starts ${daysBack.toFixed(0)} d ago, BEYOND the ${MAX_PAST_DAYS}-day horizon of this endpoint. ` +
      `Use the reanalysis archive adapter instead; this source could not have answered.`;
  }

  // Spatial representativeness. A point claim served by a ~11 km grid mean is
  // inherently approximate, and dramatically more so for convective rain than
  // for widespread frontal/monsoon rain. The caller may declare the regime.
  const regime = claim.assertion.precipitationRegime ?? 'unknown';
  const regimeFactor =
    regime === 'convective' ? 0.45 : regime === 'frontal' || regime === 'monsoon' ? 0.85 : 0.65;
  const spatialReason =
    `Point claim served by a ~${NOMINAL_GRID_KM} km grid mean. ` +
    (regime === 'convective'
      ? 'Declared convective regime: sub-grid variability is severe, so a cell mean poorly represents a point.'
      : regime === 'unknown'
        ? 'Precipitation regime not declared; scored at the midpoint. Declaring it sharpens this factor.'
        : `Declared ${regime} regime: spatially coherent, so a cell mean represents a point reasonably well.`);

  const futureFraction = endMs > Date.now() ? 0 : 1;

  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: regimeFactor, reason: spatialReason },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: temporal, reason: temporalReason },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: 1, reason: 'Model reports precipitation at 0.1 mm resolution; no practical floor for threshold claims.' },
    { factor: FACTOR.LATENCY, score: futureFraction, reason: futureFraction === 1
        ? 'Window is entirely in the past; model run covers it.'
        : 'Window extends into the future. A forecast is not evidence of what occurred.' },
  ]);
}

export async function observe(claim) {
  const { lat, lon } = claim.subject;
  const startMs = Date.parse(claim.window.start);
  const daysBack = Math.ceil((Date.now() - startMs) / 86_400_000);

  if (daysBack > MAX_PAST_DAYS) {
    return {
      sourceId: id, url: null, fetchedAt: new Date().toISOString(),
      reachability: REACHABILITY.NOT_QUERIED, httpStatus: null, bodyDigest: null, body: null,
      status: STATUS.INDETERMINATE, records: [],
      error: `window is ${daysBack} d old, beyond the ${MAX_PAST_DAYS} d horizon — not queried`,
    };
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'precipitation',
    past_days: String(Math.min(MAX_PAST_DAYS, Math.max(1, daysBack + 1))),
    forecast_days: '1',
    timezone: 'UTC',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await httpGetPaced(id, url);

  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], error: 'unparseable JSON' };
  }

  const times = parsed.hourly?.time ?? [];
  const precip = parsed.hourly?.precipitation ?? [];
  const endMs = Date.parse(claim.window.end);

  let totalMm = 0;
  let hoursCounted = 0;
  let peakHourMm = 0;
  let peakHourAt = null;
  const series = [];
  for (let i = 0; i < times.length; i += 1) {
    const t = Date.parse(`${times[i]}Z`);
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    const mm = Number(precip[i] ?? 0);
    if (!Number.isFinite(mm)) continue;
    totalMm += mm;
    hoursCounted += 1;
    if (mm > peakHourMm) { peakHourMm = mm; peakHourAt = `${times[i]}Z`; }
    if (mm > 0) series.push({ at: `${times[i]}Z`, mm: Number(mm.toFixed(2)) });
  }

  // The grid cell Open-Meteo actually served, vs the point we asked about.
  // Almost every integration throws this away. It is the basis-risk receipt.
  const servedLat = parsed.latitude;
  const servedLon = parsed.longitude;
  const gridOffsetKm = Number.isFinite(servedLat) && Number.isFinite(servedLon)
    ? Number(haversineKm({ lat, lon }, { lat: servedLat, lon: servedLon }).toFixed(2))
    : null;

  const thresholdMm = claim.assertion.thresholdMm ?? 0;
  const total = Number(totalMm.toFixed(2));

  const summary = [{
    cumulativeMm: total, thresholdMm, hoursCovered: hoursCounted,
    peakHourMm: Number(peakHourMm.toFixed(2)), peakHourAt, wetHours: series.length,
    servedGridPoint: { lat: servedLat, lon: servedLon }, gridOffsetKm,
    modelElevationM: parsed.elevation ?? null,
    caveat: 'Numerical model / reanalysis output, not a gauge measurement.',
  }];

  return {
    ...res,
    sourceId: id,
    contentDigest: contentDigest(summary),
    status: hoursCounted === 0 ? STATUS.INDETERMINATE : (total >= thresholdMm ? STATUS.POSITIVE : STATUS.NEGATIVE),
    // Stated verbatim so the caveat cannot be lost in transit to a payout engine.
    records: summary,
    series: series.slice(0, 200),
  };
}
