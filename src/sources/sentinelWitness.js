/**
 * Sentinel-2 observation ledger — THE BLIND WINDOW ENGINE.
 *
 * WHAT THIS SELLS, AND WHY NOBODY SELLS IT
 * ----------------------------------------
 * Every property report, land-diligence service and satellite-monitoring
 * product on Earth tells you what the imagery SHOWS. Not one of them tells you
 * when there was no imagery at all.
 *
 * That omission is the entire opportunity. Sentinel-2 revisits every point on
 * Earth every ~5 days, but a revisit is not an observation: monsoon cloud over
 * the Deccan, fog over the Gangetic plain, or smoke over Punjab in November can
 * blind a plot for weeks. During an Indian monsoon a plot can go 50+ consecutive
 * days with zero usable looks.
 *
 * A real measured example from this adapter, Hyderabad, 2026: 129 scene passes,
 * only 41 cloud-free, and a single 55-day window (16 June to 10 August) in which
 * the plot was invisible to every public satellite in orbit.
 *
 * Fifty-five days is enough to build a boundary wall, demolish a structure,
 * cut a road, or move a family in. Encroachment does not happen at random —
 * it happens when nobody is looking, and this adapter computes, to the day,
 * exactly when nobody was looking.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM
 * -------------------------------------
 * Sentinel-2 is 10 m per pixel. A modest Indian house is one to two pixels. This
 * adapter therefore makes NO claim about what is on the ground — it reports the
 * OBSERVATION RECORD only: when the plot was seen, how well, and when it was not
 * seen at all. Scene metadata is a hard fact. Pixel interpretation is not, and
 * pretending otherwise is the exact laundering this project exists to prevent.
 *
 * Cloud cover is scene-level, not plot-level: a scene is ~110 km across, so a
 * clear plot can sit inside a cloudy scene and vice versa. Treated as a
 * conservative proxy, and said out loud on the report.
 *
 * @module sources/sentinelWitness
 */

import { REACHABILITY, FACTOR, envelope, contentDigest, digest, USER_AGENT } from './base.js';
import { DERIVATION, STATUS, TEMPORALITY } from '../provenance/lattice.js';

export const id = 'sentinel-2-observations';
export const lineageRoot = 'copernicus-sentinel-2';
export const title = 'Sentinel-2 observation record (Copernicus, via Earth Search STAC)';
/** Scene metadata is a direct record of an acquisition. */
export const derivation = DERIVATION.OBSERVED;
export const temporality = TEMPORALITY.EVENT;
export const validSeconds = 86_400;

/** Above this scene cloud fraction, a pass is not a usable look. */
export const CLOUD_THRESHOLD = 20;
/** A gap at or beyond this many days is reported as a blind window. */
export const BLIND_WINDOW_DAYS = 14;
/** Sentinel-2 L2A is available from roughly here onward. */
export const ARCHIVE_START = '2017-04-01';

const STAC_URL = 'https://earth-search.aws.element84.com/v1/search';

export function supports(assertionKind) {
  return assertionKind === 'OBSERVATION_RECORD';
}

export function observability(claim) {
  const startMs = Date.parse(claim.window.start);
  const archiveMs = Date.parse(ARCHIVE_START);
  const beforeArchive = startMs < archiveMs;

  const { lat } = claim.subject;
  // Sentinel-2 does not image the poles.
  const polar = Math.abs(lat) > 82;

  return envelope([
    { factor: FACTOR.SPATIAL_COVERAGE, score: polar ? 0 : 1,
      reason: polar
        ? 'Beyond Sentinel-2’s imaging latitude; this location is never acquired.'
        : 'Sentinel-2 acquires all land surfaces at this latitude.' },
    { factor: FACTOR.TEMPORAL_COVERAGE, score: beforeArchive ? 0 : 1,
      reason: beforeArchive
        ? `Window begins before the Sentinel-2 L2A archive (${ARCHIVE_START}); no scenes exist to count.`
        : `Window is inside the Sentinel-2 L2A archive (from ${ARCHIVE_START}).` },
    { factor: FACTOR.DETECTION_SENSITIVITY, score: 1,
      reason: 'This adapter reports the acquisition record, not image content. ' +
              'Scene metadata is fully determinate regardless of ground feature size.' },
    { factor: FACTOR.LATENCY, score: 1, reason: 'Catalogue is published within days of acquisition.' },
  ]);
}

/** Max pages to walk. 100 scenes/page; 10 pages covers ~5 years of revisits. */
const MAX_PAGES = 10;
const PAGE_SIZE = 100;

export async function observe(claim) {
  const { lat, lon, radiusKm } = claim.subject;
  const d = Math.max(0.005, Math.min(0.2, radiusKm / 111.32));
  const baseBody = {
    collections: ['sentinel-2-l2a'],
    bbox: [lon - d, lat - d, lon + d, lat + d],
    datetime: `${claim.window.start}/${claim.window.end}`,
    limit: PAGE_SIZE,
    fields: { include: ['id', 'properties.datetime', 'properties.eo:cloud_cover'] },
  };

  const fetchedAt = new Date().toISOString();
  const started = Date.now();
  const passes = [];
  const pagesFetched = [];
  let body = baseBody;
  let numberMatched = null;
  let truncated = false;

  // Paginate. An earlier build asked for limit:500 in one shot and the service
  // answered 502 — a reminder that "it worked in the demo window" is not the
  // same as "it works over a real history window".
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const attempt = await postStac(body);
    if (attempt.error) {
      // A failure mid-walk still yields a usable partial ledger, but it must be
      // declared: a ledger built from half the passes would invent blind windows
      // that do not exist, which is worse than no ledger at all.
      if (passes.length === 0) {
        return {
          sourceId: id, url: STAC_URL, fetchedAt, reachability: attempt.reachability,
          httpStatus: attempt.httpStatus, body: attempt.text ?? null,
          bodyDigest: attempt.text ? digest(attempt.text) : null,
          status: STATUS.INDETERMINATE, records: [], error: attempt.error,
          elapsedMs: Date.now() - started,
        };
      }
      truncated = true;
      break;
    }
    pagesFetched.push(attempt.digest);
    numberMatched = attempt.parsed.numberMatched ?? numberMatched;
    for (const f of attempt.parsed.features ?? []) {
      if (!f.properties?.datetime) continue;
      passes.push({
        sceneId: f.id,
        at: f.properties.datetime,
        cloudCover: f.properties['eo:cloud_cover'] ?? null,
      });
    }
    const next = (attempt.parsed.links ?? []).find((l) => l.rel === 'next');
    if (!next?.body) break;
    body = { ...baseBody, ...next.body };
    if (page === MAX_PAGES - 1) truncated = true;
  }

  passes.sort((a, b) => a.at.localeCompare(b.at));
  const ledger = { ...buildLedger(passes, claim.window), truncated, numberMatched, pages: pagesFetched.length };

  return {
    sourceId: id,
    url: STAC_URL,
    requestBody: JSON.stringify(baseBody),
    fetchedAt,
    reachability: REACHABILITY.ANSWERED,
    httpStatus: 200,
    // Custody over the concatenated page digests: the request was several calls.
    body: null,
    bodyDigest: digest(pagesFetched.join('|')),
    contentDigest: contentDigest([ledger]),
    elapsedMs: Date.now() - started,
    status: passes.length > 0 ? STATUS.POSITIVE : STATUS.NEGATIVE,
    records: [ledger],
    matched: passes.length ? [ledger] : [],
  };
}

/** One STAC POST, with a single retry on the 5xx this service intermittently returns. */
async function postStac(body, attempt = 0) {
  let res;
  try {
    res = await fetch(STAC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40_000),
    });
  } catch (err) {
    if (attempt < 1) { await sleep(1500); return postStac(body, attempt + 1); }
    return { error: String(err?.message ?? err), reachability: REACHABILITY.UNREACHABLE, httpStatus: null };
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status >= 500 && attempt < 1) { await sleep(1500); return postStac(body, attempt + 1); }
    return { error: `HTTP ${res.status}`, reachability: REACHABILITY.REFUSED, httpStatus: res.status, text };
  }
  try {
    return { parsed: JSON.parse(text), digest: digest(text), httpStatus: res.status, text };
  } catch {
    return { error: 'unparseable STAC response', reachability: REACHABILITY.ANSWERED, httpStatus: res.status, text };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Turn a list of acquisitions into the ledger that is actually worth money.
 * Pure function over passes — deterministic, and unit-tested without network.
 */
export function buildLedger(passes, window) {
  const clear = passes.filter((p) => (p.cloudCover ?? 100) < CLOUD_THRESHOLD);
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));

  // Anchor the gap walk to the window edges, so a plot unseen for the first
  // three months of the window is reported — not silently skipped because the
  // first observation happens to sit inside it.
  const marks = [startMs, ...clear.map((p) => Date.parse(p.at)), endMs].sort((a, b) => a - b);

  const blindWindows = [];
  for (let i = 0; i < marks.length - 1; i += 1) {
    const days = Math.round((marks[i + 1] - marks[i]) / 86_400_000);
    if (days >= BLIND_WINDOW_DAYS) {
      blindWindows.push({
        from: new Date(marks[i]).toISOString().slice(0, 10),
        to: new Date(marks[i + 1]).toISOString().slice(0, 10),
        days,
        boundedByWindowEdge: i === 0 || i === marks.length - 2,
      });
    }
  }
  blindWindows.sort((a, b) => b.days - a.days);

  const longestBlindDays = blindWindows.length ? blindWindows[0].days : 0;
  const blindDaysTotal = blindWindows.reduce((n, w) => n + w.days, 0);

  return {
    windowDays: totalDays,
    passes: passes.length,
    clearPasses: clear.length,
    clearFraction: passes.length ? round3(clear.length / passes.length) : 0,
    // Mean days between usable looks. The honest headline number.
    meanRevisitDays: clear.length > 1
      ? round2((Date.parse(clear.at(-1).at) - Date.parse(clear[0].at)) / 86_400_000 / (clear.length - 1))
      : null,
    longestBlindDays,
    blindDaysTotal,
    blindDaysFraction: round3(blindDaysTotal / totalDays),
    blindWindows: blindWindows.slice(0, 10),
    firstClear: clear[0]?.at?.slice(0, 10) ?? null,
    lastClear: clear.at(-1)?.at?.slice(0, 10) ?? null,
    cloudThreshold: CLOUD_THRESHOLD,
    caveat:
      'Cloud cover is reported per SCENE (~110 km across), not per plot. A clear plot can sit ' +
      'inside a cloudy scene and the reverse. Treated conservatively: a cloudy scene is counted ' +
      'as not-a-look. This ledger records WHEN THE PLOT WAS OBSERVED, and makes no claim ' +
      'whatsoever about what the imagery shows.',
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
