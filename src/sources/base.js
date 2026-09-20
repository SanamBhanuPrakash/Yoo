/**
 * Source adapter contract.
 *
 * Every adapter answers TWO questions, and keeping them separate is the whole
 * design. God's Eye View's layers answer only the first:
 *
 *   1. observe(claim)      — what does this source say?
 *   2. observability(claim) — COULD this source have said anything at all?
 *
 * Question 2 is the one that is almost universally skipped, and skipping it is
 * how "no data" silently becomes "nothing happened". A wildfire detector that
 * was on the other side of the planet during the window in question has not
 * told you the fire did not occur. It has told you nothing, and a system that
 * cannot represent "nothing" will fabricate a negative.
 *
 * @module sources/base
 */

import { createHash } from 'node:crypto';

/** Outcome of a fetch, independent of whether evidence was found. */
export const REACHABILITY = Object.freeze({
  /** Source answered with a well-formed payload. */
  ANSWERED: 'ANSWERED',
  /** Source answered but declined (quota, auth, rate limit). */
  REFUSED: 'REFUSED',
  /** Source unreachable (network, DNS, timeout). */
  UNREACHABLE: 'UNREACHABLE',
  /** We never asked — licence gate, or no credential configured. */
  NOT_QUERIED: 'NOT_QUERIED',
});

/**
 * Observability factors. Each is a 0..1 multiplier with a stated reason.
 * The index is the PRODUCT, not the mean: a zero on any single factor means
 * the source genuinely could not have seen it, and averaging would hide that.
 *
 * This is deliberate and it is the opposite of how confidence scores are
 * usually built. Most systems average their way to a comfortable 0.6. Here,
 * one hard zero produces a hard zero, and the engine then refuses to render
 * a verdict rather than rendering a weak one.
 */
export const FACTOR = Object.freeze({
  /** Is the location inside the source's spatial domain? */
  SPATIAL_COVERAGE: 'SPATIAL_COVERAGE',
  /** Does the source's revisit/publish cadence intersect the claim window? */
  TEMPORAL_COVERAGE: 'TEMPORAL_COVERAGE',
  /** Is the claimed magnitude above this source's detection floor? */
  DETECTION_SENSITIVITY: 'DETECTION_SENSITIVITY',
  /** Did the source actually answer when asked? */
  AVAILABILITY: 'AVAILABILITY',
  /** Was the data published soon enough to cover the window? */
  LATENCY: 'LATENCY',
});

/**
 * Compute an observability envelope from factor scores.
 * @param {Array<{factor: string, score: number, reason: string}>} factors
 */
export function envelope(factors) {
  const index = factors.reduce((acc, f) => acc * clamp01(f.score), 1);
  const blockers = factors.filter((f) => clamp01(f.score) === 0).map((f) => f.factor);
  return {
    index: round4(index),
    factors: factors.map((f) => ({ ...f, score: round4(clamp01(f.score)) })),
    blockers,
    observable: index > 0,
  };
}

export function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Hash a raw upstream payload. The hash — not the payload — is what makes the
 * attestation reproducible: a verifier who re-fetches can prove byte-identity
 * without us redistributing a feed we may have no right to redistribute.
 *
 * That is a licensing feature disguised as a cryptography feature. It is how
 * an attestation over ODbL or proprietary data stays shareable: the evidence
 * bundle commits to what we saw without republishing it.
 */
export function digest(text) {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Semantic content digest — a hash over what the source MEANT, not over the
 * bytes it happened to send.
 *
 * Learned the hard way, and worth stating plainly: USGS embeds
 * `metadata.generated`, a per-request epoch timestamp, in every GeoJSON
 * response. Hashing the raw body therefore NEVER reproduces, and a verifier
 * built on raw-body hashing would cry tampering on every single re-check
 * while catching nothing. An alarm that always fires is worse than no alarm,
 * because people switch it off.
 *
 * So there are two digests, doing two different jobs:
 *
 *   responseDigest  raw bytes — chain of custody. Proves exactly what arrived.
 *                   Expected to drift; informational on re-verification.
 *   contentDigest   normalised records — reproducibility. Answers the question
 *                   that actually matters: does this source still say the same
 *                   thing about this claim?
 *
 * Keys are sorted and undefined dropped so the digest is stable across runs.
 */
export function contentDigest(records) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v === null || typeof v !== 'object') return v === undefined ? null : v;
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] === undefined) continue;
      out[k] = norm(v[k]);
    }
    return out;
  };
  return digest(JSON.stringify(norm(records ?? [])));
}

/**
 * HTTP with an explicit, recorded outcome. Never throws for a bad response:
 * a refusal is DATA about observability, not an exception to be swallowed.
 *
 * @returns {{reachability: string, httpStatus: number|null, body: string|null,
 *            bodyDigest: string|null, url: string, fetchedAt: string,
 *            elapsedMs: number, error: string|null}}
 */
export async function httpGet(url, { timeoutMs = 25_000, headers = {} } = {}) {
  const startedAt = Date.now();
  const fetchedAt = new Date(startedAt).toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = {
    url,
    fetchedAt,
    httpStatus: null,
    body: null,
    bodyDigest: null,
    error: null,
  };
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    });
    const body = await res.text();
    const elapsedMs = Date.now() - startedAt;
    if (!res.ok) {
      return {
        ...base,
        reachability: REACHABILITY.REFUSED,
        httpStatus: res.status,
        body,
        bodyDigest: digest(body),
        elapsedMs,
        error: `HTTP ${res.status}`,
      };
    }
    return {
      ...base,
      reachability: REACHABILITY.ANSWERED,
      httpStatus: res.status,
      body,
      bodyDigest: digest(body),
      elapsedMs,
    };
  } catch (err) {
    return {
      ...base,
      reachability: REACHABILITY.UNREACHABLE,
      elapsedMs: Date.now() - startedAt,
      error: err?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(err?.message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-source minimum request interval.
 *
 * Several registry entries carry OBLIGATION.RATE_LIMITED, which means the rate
 * limit is a LICENCE TERM, not merely an engineering courtesy: Nominatim's
 * usage policy states 1 req/s, GDELT asks for 1 req/5s. Documenting that in a
 * table and then ignoring it in the client is precisely the gap this project
 * exists to close, so the limiter lives here, on the shared request path,
 * where it cannot be forgotten.
 */
const PACING_MS = Object.freeze({
  gdelt: 5200,
  nominatim: 1100,
  'open-meteo': 250,
  'open-meteo-archive': 250,
  'usgs-earthquakes': 250,
});

const lastCallAt = new Map();

/** Wait out a source's minimum interval before letting a request through. */
export async function pace(sourceId) {
  const minGap = PACING_MS[sourceId] ?? 0;
  if (minGap === 0) return 0;
  const previous = lastCallAt.get(sourceId) ?? 0;
  const waitMs = Math.max(0, previous + minGap - Date.now());
  lastCallAt.set(sourceId, Date.now() + waitMs);
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  return waitMs;
}

/**
 * Paced GET with one bounded retry on a refusal that looks transient.
 *
 * A 429/503 from a shared upstream is a statement about the CALLER, not about
 * the world, so retrying once is honest. A 4xx that is not a rate limit is a
 * statement about the request, and is not retried.
 */
export async function httpGetPaced(sourceId, url, options = {}) {
  await pace(sourceId);
  let res = await httpGet(url, options);
  const transient = res.httpStatus === 429 || res.httpStatus === 503 ||
    res.reachability === REACHABILITY.UNREACHABLE;
  if (transient) {
    await pace(sourceId);
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await httpGet(url, options);
    retry.retried = true;
    retry.firstAttempt = { httpStatus: res.httpStatus, reachability: res.reachability, error: res.error };
    res = retry;
  }
  return res;
}

export const USER_AGENT =
  'sakshya-evidence-engine/0.1 (+https://github.com/SanamBhanuPrakash/sakshya) contact-via-repo';

/** Great-circle distance in km. Deterministic, no free parameters → DERIVED. */
export function haversineKm(a, b) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
