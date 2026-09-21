/**
 * Place History Report — the product.
 *
 * WHO BUYS THIS, AND WHY IT IS NOT A DASHBOARD
 * -------------------------------------------
 * Someone is about to commit a large sum to a piece of land they have not
 * stood on. An NRI buying in their home state from six thousand kilometres
 * away. A first-time buyer on a city fringe. A lawyer preparing a boundary
 * dispute. A bank officer who cannot visit every plot.
 *
 * Existing services answer "who owns it on paper" — title search, encumbrance
 * certificate. Nothing affordable answers "what is physically true of this
 * ground, and how would I know if someone lied to me about it."
 *
 * THE FEATURE NOBODY ELSE SELLS
 * -----------------------------
 * Every satellite-backed report over-claims: it shows you a picture and lets
 * you infer continuous knowledge. This one leads with the opposite — the
 * BLIND WINDOW LEDGER, computed to the day:
 *
 *   "Between 16 June and 10 August, this plot was invisible to every public
 *    satellite in orbit. Fifty-five consecutive days with no usable look."
 *
 * That is a real measured figure for a real Hyderabad plot. Fifty-five days is
 * enough to raise a boundary wall, demolish a structure, cut an access road, or
 * move a family in. Encroachment is not random — it happens when nobody is
 * looking, and this report is the only one that says precisely when that was.
 *
 * Selling the gap rather than the picture is the whole inversion. It is also
 * the one claim a competitor cannot cheaply copy, because making it requires
 * being willing to tell the customer what you do not know.
 *
 * @module reports/placeHistory
 */

import { evaluate } from '../engine/evaluate.js';
import { httpGetPaced, REACHABILITY } from '../sources/base.js';
import { USE } from '../license/registry.js';

/**
 * Build the full report for a point.
 *
 * @param {object} args
 * @param {number} args.lat
 * @param {number} args.lon
 * @param {string} [args.label]
 * @param {number} [args.radiusKm]      plot context radius
 * @param {number} [args.historyYears]  how far back to build the observation ledger
 * @param {string} [args.intendedUse]
 */
export async function buildPlaceHistory({
  lat, lon, label = null, radiusKm = 1, historyYears = 2,
  intendedUse = USE.COMMERCIAL_REDISTRIBUTION,
}) {
  const now = new Date();
  const end = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const start = new Date(now.getTime() - historyYears * 365.25 * 86_400_000)
    .toISOString().replace(/\.\d{3}Z$/, 'Z');

  const place = await reverseGeocode(lat, lon);
  const resolvedLabel = label ?? place?.displayName ?? null;
  const subject = { lat, lon, radiusKm, label: resolvedLabel };

  // Each section is an independent claim through the same engine, so every
  // section inherits the licence gate, the observability scoring and the
  // provenance lattice for free. That reuse is why the earlier work was not
  // wasted: it was the hard half, built first.
  const sections = {};

  sections.observation = await evaluate({
    subject, window: { start, end }, intendedUse,
    assertion: { kind: 'OBSERVATION_RECORD' },
  });

  sections.terrain = await evaluate({
    subject, window: { start, end }, intendedUse,
    assertion: { kind: 'TERRAIN_CONTEXT' },
  });

  // Seismic history over a wider radius and a longer reach than the plot
  // window: what matters for a building is the regional record, not two years.
  const seismicStart = new Date(now.getTime() - 25 * 365.25 * 86_400_000)
    .toISOString().replace(/\.\d{3}Z$/, 'Z');
  sections.seismic = await evaluate({
    subject: { ...subject, radiusKm: 150 },
    window: { start: seismicStart, end },
    intendedUse,
    assertion: { kind: 'SEISMIC_EVENT', minMagnitude: 4.0 },
  });

  // Recent precipitation, within the endpoint's honest horizon.
  const rainStart = new Date(now.getTime() - 85 * 86_400_000)
    .toISOString().replace(/\.\d{3}Z$/, 'Z');
  sections.recentRainfall = await evaluate({
    subject, window: { start: rainStart, end }, intendedUse,
    assertion: { kind: 'RAINFALL_EXCEEDED', thresholdMm: 0.1, precipitationRegime: 'unknown' },
  });

  return {
    formatVersion: 'sakshya-place-history/1',
    subject,
    place,
    window: { start, end, historyYears },
    sections,
    highlights: extractHighlights(sections),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Pull the handful of facts a buyer actually acts on. Deliberately small:
 * a report whose headline is twelve numbers has no headline.
 */
function extractHighlights(sections) {
  const out = [];

  const ledger = firstRecord(sections.observation);
  if (ledger) {
    if (ledger.longestBlindDays >= 30) {
      out.push({
        kind: 'BLIND_WINDOW', severity: 'HIGH',
        headline: `${ledger.longestBlindDays} consecutive days with no usable satellite view`,
        detail:
          `The longest unobserved stretch ran ${ledger.blindWindows[0].from} to ` +
          `${ledger.blindWindows[0].to}. Across the whole period, ` +
          `${Math.round(ledger.blindDaysFraction * 100)}% of days fell inside a blind window of ` +
          `two weeks or more. Any physical change during those stretches leaves no public trace.`,
      });
    } else if (ledger.clearPasses > 0) {
      out.push({
        kind: 'BLIND_WINDOW', severity: 'LOW',
        headline: `Well observed — a usable satellite view roughly every ${ledger.meanRevisitDays} days`,
        detail: `${ledger.clearPasses} cloud-free passes out of ${ledger.passes}. ` +
          `Longest gap ${ledger.longestBlindDays} days.`,
      });
    }
  }

  const terrain = firstRecord(sections.terrain);
  if (terrain) {
    const severity = terrain.classification === 'CLOSED_DEPRESSION' ? 'HIGH'
      : terrain.classification === 'OPEN_DEPRESSION' ? 'MEDIUM' : 'LOW';
    out.push({
      kind: 'WATER', severity,
      headline: terrainHeadline(terrain),
      detail: terrain.waterBehaviour,
    });
  }

  const quakes = sections.seismic?.findings?.find((f) => f.sourceId === 'usgs-earthquakes');
  const matched = quakes?.evidence?.matched ?? 0;
  if (matched > 0) {
    const top = quakes.evidence.records[0];
    out.push({
      kind: 'SEISMIC', severity: (top?.magnitude ?? 0) >= 6 ? 'HIGH' : 'MEDIUM',
      headline: `${matched} earthquake(s) of M4.0+ within 150 km in the last 25 years`,
      detail: `Strongest recorded: M${top?.magnitude} at ${top?.distanceKm} km (${top?.time?.slice(0, 10)}).`,
    });
  } else if (quakes && quakes.observability.index >= 0.6) {
    out.push({
      kind: 'SEISMIC', severity: 'LOW',
      headline: 'No M4.0+ earthquake recorded within 150 km in 25 years',
      detail: 'The regional catalogue has the coverage to have detected one at this magnitude.',
    });
  }

  return out;
}

function terrainHeadline(t) {
  switch (t.classification) {
    case 'CLOSED_DEPRESSION': return `Sits ${t.depressionM} m low with no drainage path — water ponds here`;
    case 'OPEN_DEPRESSION': return `Sits ${t.depressionM} m below surroundings; water gathers, then drains`;
    case 'SLOPING_GROUND': return `Sloping ground, about ${t.gradientPct}% gradient`;
    case 'ELEVATED': return `Sits about ${Math.abs(t.depressionM)} m above its surroundings`;
    default: return 'Height relative to surroundings cannot be resolved from public elevation data';
  }
}

function firstRecord(section) {
  for (const f of section?.findings ?? []) {
    const r = f.evidence?.records?.[0];
    if (r) return r;
  }
  return null;
}

/** OSM Nominatim reverse geocode for a human-readable location line. */
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`;
  const res = await httpGetPaced('nominatim', url);
  if (res.reachability !== REACHABILITY.ANSWERED) return null;
  try {
    const j = JSON.parse(res.body);
    return {
      displayName: j.display_name ?? null,
      state: j.address?.state ?? null,
      district: j.address?.state_district ?? j.address?.county ?? null,
      country: j.address?.country ?? null,
      attribution: '© OpenStreetMap contributors (ODbL)',
    };
  } catch { return null; }
}
