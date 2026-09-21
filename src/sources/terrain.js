/**
 * Terrain and water-collection analysis (SRTM 30 m via OpenTopoData).
 *
 * WHAT THIS ANSWERS
 * -----------------
 * "Does water collect on this plot?" is the single most consequential question
 * about a piece of Indian land that no cheap service answers. Flood-zone maps
 * are coarse, municipal, often decades stale, and frequently unavailable for
 * peri-urban land — which is exactly where people buy.
 *
 * But local topography answers a large part of it, and it is computable. This
 * adapter samples a ring pattern around the plot and asks: is the subject
 * sitting in a hollow relative to its immediate surroundings, and if so, is
 * that hollow closed (water ponds) or open (water drains)?
 *
 * THE HONESTY THAT MAKES IT DEFENSIBLE
 * ------------------------------------
 * SRTM's absolute vertical accuracy is roughly 16 m at 90% confidence. If this
 * adapter reported "your plot sits 4 m low" as a fact, it would be quoting a
 * number four times smaller than its own error bar — which is precisely the
 * laundering this project exists to prevent.
 *
 * What rescues it is that *relative* accuracy over short baselines is far better
 * than absolute: the systematic component of the error is shared between nearby
 * posts and cancels in a difference. That is a real property of the dataset and
 * it is why a local differential comparison is legitimate where an absolute
 * elevation claim would not be.
 *
 * It is still not free. So the adapter carries an explicit RELATIVE_NOISE_M
 * floor, and any depression shallower than it is reported as INDETERMINATE
 * rather than as a shallow depression. The provenance chain says the rest:
 *
 *     elevation        OBSERVED   radar measurement product
 *     depression index DERIVED    deterministic arithmetic over those
 *     "water collects" ESTIMATED  a heuristic, and labelled as one
 *
 * That three-step chain on real ground is the lattice doing its job.
 *
 * @module sources/terrain
 */

import { REACHABILITY, FACTOR, envelope, httpGetPaced, contentDigest } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'srtm-terrain';
export const lineageRoot = 'nasa-srtm';
export const title = 'SRTM 30 m elevation (NASA/USGS, via OpenTopoData)';
export const derivation = DERIVATION.OBSERVED;
/** Terrain is a standing fact, not a sampled state. */
export const temporality = TEMPORALITY.EVENT;
export const validSeconds = 315_360_000; // decade-scale

/**
 * Differential noise floor over a few-hundred-metre baseline. Conservative.
 * A depression shallower than this is not distinguishable from DEM noise, and
 * is reported as such rather than dressed up.
 */
export const RELATIVE_NOISE_M = 3;

/** SRTM covers 60N to 56S. Outside that, this adapter genuinely cannot answer. */
const SRTM_MAX_LAT = 60;
const SRTM_MIN_LAT = -56;

export function supports(assertionKind) {
  return assertionKind === 'TERRAIN_CONTEXT';
}

export function observability(claim) {
  const { lat } = claim.subject;
  const covered = lat <= SRTM_MAX_LAT && lat >= SRTM_MIN_LAT;
  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: covered ? 1 : 0,
      reason: covered
        ? `Latitude ${lat.toFixed(3)} is inside SRTM coverage (${SRTM_MIN_LAT} to ${SRTM_MAX_LAT}).`
        : `Latitude ${lat.toFixed(3)} is outside SRTM coverage; this source could not have measured it.` },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: 1,
      reason: 'SRTM is a single-epoch (2000) survey. Terrain is treated as standing, but note ' +
              'that earthworks, quarrying, levelling and landfill since 2000 are NOT reflected.' },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: 0.7,
      reason: `30 m posting and a ~${RELATIVE_NOISE_M} m differential noise floor. Adequate for ` +
              'detecting whether a plot sits in a hollow; inadequate for fine grading or ' +
              'sub-metre drainage questions.' },
    { factor: FACTOR.LATENCY, score: 1, reason: 'Static archive.' },
  ]);
}

/** Ring offsets in metres. Centre, inner ring, outer ring. */
const RINGS = [60, 150, 300];
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

function offset(lat, lon, metres, bearingDeg) {
  const dLat = metres / 111_320;
  const dLon = metres / (111_320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const r = (bearingDeg * Math.PI) / 180;
  return { lat: lat + dLat * Math.cos(r), lon: lon + dLon * Math.sin(r) };
}

export async function observe(claim) {
  const { lat, lon } = claim.subject;

  const points = [{ lat, lon, ring: 0, bearing: null }];
  for (const m of RINGS) {
    for (const b of BEARINGS) {
      const p = offset(lat, lon, m, b);
      points.push({ ...p, ring: m, bearing: b });
    }
  }

  const locations = points.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|');
  const url = `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locations)}`;
  const res = await httpGetPaced(id, url);

  if (res.reachability !== REACHABILITY.ANSWERED) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [] };
  }
  let parsed;
  try { parsed = JSON.parse(res.body); } catch {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [], error: 'unparseable response' };
  }
  const results = parsed.results ?? [];
  if (results.length !== points.length) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [],
      error: `expected ${points.length} elevations, received ${results.length}` };
  }

  const samples = points.map((p, i) => ({ ...p, elevationM: results[i]?.elevation ?? null }))
    .filter((s) => Number.isFinite(s.elevationM));
  if (samples.length < 9) {
    return { ...res, sourceId: id, status: STATUS.INDETERMINATE, records: [],
      error: 'too few valid elevation samples (DEM voids)' };
  }

  const analysis = analyseTerrain(samples);
  return {
    ...res,
    sourceId: id,
    contentDigest: contentDigest([analysis]),
    status: STATUS.POSITIVE,
    records: [analysis],
    matched: [analysis],
  };
}

/**
 * Pure terrain analysis. Separated from I/O so it is unit-testable with
 * synthetic landscapes — a bowl, a ridge, a flat plain, a slope.
 */
export function analyseTerrain(samples) {
  const centre = samples.find((s) => s.ring === 0);
  const ring = samples.filter((s) => s.ring > 0);
  const outer = samples.filter((s) => s.ring === RINGS.at(-1));
  const elevations = samples.map((s) => s.elevationM);

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const ringMean = mean(ring.map((s) => s.elevationM));
  const outerMean = outer.length ? mean(outer.map((s) => s.elevationM)) : ringMean;

  // Positive = the centre sits BELOW its surroundings, so water runs toward it.
  const depressionM = round2(ringMean - centre.elevationM);
  const localReliefM = round2(Math.max(...elevations) - Math.min(...elevations));

  // ---- Slope must be separated from hollow-ness -------------------------
  // On a hillside the ring spread is dominated by the regional gradient: the
  // uphill side cancels the downhill side, so `depressionM` lands near zero (or
  // reads "elevated" on a spur) and means nothing about whether water collects.
  // Diagnosing slope FIRST is what stops a Himalayan hillside being reported
  // with the same vocabulary as a Deccan hollow.
  const outerSpreadM = outer.length
    ? round2(Math.max(...outer.map((s) => s.elevationM)) - Math.min(...outer.map((s) => s.elevationM)))
    : 0;
  const gradientPct = round2((outerSpreadM / (2 * RINGS.at(-1))) * 100);
  const slopeDominated = outerSpreadM > Math.max(RELATIVE_NOISE_M * 2, Math.abs(depressionM) * 3);

  // Drainage: any sampled direction offering ground at or below the centre.
  // Deduplicated by compass point — the same bearing is sampled on every ring,
  // and reporting "N/N/N" was a presentation bug, not three escape routes.
  const escapes = ring.filter((s) => s.elevationM <= centre.elevationM);
  const lowestEscape = escapes.length ? Math.min(...escapes.map((s) => s.elevationM)) : null;
  const escapeBearings = [...new Set(escapes.map((s) => compass(s.bearing)))];

  const downhill = ring.filter((s) => s.elevationM < centre.elevationM).map((s) => s.bearing);
  const aspectDeg = downhill.length ? circularMeanBearing(downhill) : NaN;

  const significant = Math.abs(depressionM) >= RELATIVE_NOISE_M;

  let classification;
  let waterBehaviour;
  let conclusionDerivation = DERIVATION.ESTIMATED;

  if (slopeDominated) {
    classification = 'SLOPING_GROUND';
    waterBehaviour =
      `Local terrain is dominated by a gradient of roughly ${gradientPct}% ` +
      `(${outerSpreadM} m of fall across the sampled 600 m), running downhill toward ` +
      `${Number.isNaN(aspectDeg) ? 'no consistent direction' : compass(aspectDeg)}. ` +
      'On sloping ground surface water moves through rather than collects. The relevant ' +
      'questions here are run-off velocity, cut-and-fill stability and upslope catchment ' +
      '\u2014 none of which this adapter assesses.';
  } else if (!significant) {
    classification = 'INDISTINGUISHABLE';
    waterBehaviour =
      `The plot is within ${RELATIVE_NOISE_M} m of its surroundings \u2014 inside this DEM\u2019s ` +
      'differential noise floor. Whether it sits high or low CANNOT be determined from SRTM. ' +
      'This is NOT a finding of level ground; it is a finding that the question is unanswered ' +
      'and needs a ground survey.';
    conclusionDerivation = null;
  } else if (depressionM > 0 && escapes.length === 0) {
    classification = 'CLOSED_DEPRESSION';
    waterBehaviour =
      `The plot sits about ${depressionM} m below every sampled direction within 300 m. ` +
      'Surface water running off the surrounding land has no sampled path away from it. ' +
      'Plots with this signature pond during heavy rain unless artificially drained.';
  } else if (depressionM > 0) {
    classification = 'OPEN_DEPRESSION';
    waterBehaviour =
      `The plot sits about ${depressionM} m below its surroundings, but lower ground lies ` +
      `toward ${escapeBearings.join(', ')}, giving surface water a path away. Water gathers ` +
      'here and then drains, rather than standing.';
  } else {
    classification = 'ELEVATED';
    waterBehaviour =
      `The plot sits about ${Math.abs(depressionM)} m above its immediate surroundings. ` +
      'Surface water runs off it rather than toward it.';
  }

  return {
    centreElevationM: centre.elevationM,
    surroundingMeanM: round2(ringMean),
    outerRingMeanM: round2(outerMean),
    depressionM,
    localReliefM,
    outerSpreadM,
    gradientPct,
    slopeDominated,
    classification,
    waterBehaviour,
    closedDepression: classification === 'CLOSED_DEPRESSION',
    drainageBearings: escapeBearings,
    lowestEscapeElevationM: lowestEscape,
    downhillAspect: Number.isNaN(aspectDeg) ? null : compass(aspectDeg),
    significant,
    noiseFloorM: RELATIVE_NOISE_M,
    samplesUsed: samples.length,
    ringRadiiM: RINGS,
    provenanceNote:
      'Elevation values are OBSERVED (radar measurement product). The depression and gradient ' +
      'figures are DERIVED (deterministic arithmetic over those). The water-behaviour conclusion ' +
      'is ESTIMATED (a topographic heuristic) and is NOT a flood model, a flood-zone ' +
      'determination, or a substitute for a drainage survey.',
    surfaceModelCaveat:
      'CRITICAL: SRTM is a SURFACE model, not a bare-earth model. Over buildings and tree canopy ' +
      'it measures the ROOF or the TREETOP, not the ground. In dense built-up or forested areas ' +
      'these figures describe the top of the clutter and must not be read as ground levels. ' +
      'This analysis is most reliable on open, unbuilt and agricultural land \u2014 which is the ' +
      'land most often bought sight-unseen, and so still the case that matters most.',
    epochCaveat:
      'SRTM was surveyed in 2000. Levelling, landfill, quarrying or earthworks since then are ' +
      'not reflected \u2014 which matters most on exactly the peri-urban land people are buying.',
    conclusionDerivation,
  };
}

function circularMeanBearing(bearings) {
  if (!bearings.length) return NaN;
  const rad = bearings.map((b) => (b * Math.PI) / 180);
  const x = rad.reduce((a, r) => a + Math.cos(r), 0) / rad.length;
  const y = rad.reduce((a, r) => a + Math.sin(r), 0) / rad.length;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function compass(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(((deg % 360) / 45)) % 8];
}

function round2(n) { return Math.round(n * 100) / 100; }
