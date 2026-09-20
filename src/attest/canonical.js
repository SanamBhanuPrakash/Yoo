/**
 * Canonical JSON — the basis of reproducibility.
 *
 * Two logically identical bundles must serialise to identical bytes, or the
 * signature is worthless and "reproducible" is marketing. Rules:
 *   - object keys sorted by code unit
 *   - no insignificant whitespace
 *   - undefined dropped; null retained (null is a fact, undefined is an absence)
 *   - numbers rendered via the shortest round-trip form JSON.stringify gives
 *   - non-finite numbers rejected rather than silently becoming null
 *
 * @module attest/canonical
 */

export function canonicalise(value) {
  return JSON.stringify(sortDeep(value));
}

export function sortDeep(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sortDeep);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`non-finite number cannot be canonicalised: ${value}`);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const v = value[key];
    if (v === undefined) continue;
    out[key] = sortDeep(v);
  }
  return out;
}

/**
 * Fields that legitimately differ between two runs of the same evaluation
 * (wall-clock timings, network latency) and must therefore be excluded from
 * the reproducibility hash while remaining visible in the bundle.
 *
 * Being explicit about this list is the honest part: a system that hashes
 * everything cannot be reproduced, and one that quietly hashes nothing can be
 * reproduced trivially and proves nothing. The line has to be drawn somewhere
 * visible, and this is where.
 */
export const VOLATILE_PATHS = Object.freeze([
  'timing', 'elapsedMs', 'fetchedAt', 'generatedAt', 'signature', 'retried', 'firstAttempt',
]);

export function stripVolatile(value, volatile = VOLATILE_PATHS) {
  const drop = new Set(volatile);
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== 'object') return v;
    const out = {};
    for (const k of Object.keys(v)) {
      if (drop.has(k)) continue;
      out[k] = walk(v[k]);
    }
    return out;
  };
  return walk(value);
}
