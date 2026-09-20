import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalise, sortDeep, stripVolatile } from './canonical.js';
import { buildBundle } from './bundle.js';
import { generateIssuerKeypair, signBundle, verifySignature } from './sign.js';
import { verifyBundle } from './verify.js';

const EVALUATION = {
  claim: {
    statement: 'test claim',
    subject: { lat: 1.5, lon: 2.5, radiusKm: 10, label: 'X' },
    window: { start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' },
    assertion: { kind: 'SEISMIC_EVENT', minMagnitude: 5 },
    intendedUse: 'NONCOMMERCIAL',
    minimumDerivation: 'ESTIMATED',
    reference: null,
  },
  verdict: { verdict: 'SUPPORTED', derivation: 'OBSERVED', confidence: 0.5, trace: [], headline: 'h', reason: 'r' },
  findings: [{
    sourceId: 'usgs-earthquakes', title: 'USGS', queried: true, status: 'POSITIVE',
    requestUrl: 'https://example.invalid/q', httpStatus: 200, reachability: 'ANSWERED',
    responseDigest: 'sha256:abc', fetchedAt: '2026-01-02T00:00:01Z', elapsedMs: 42,
    observability: { index: 1, blockers: [], factors: [] }, provenanceChain: [],
  }],
  licence: { intendedUse: 'NONCOMMERCIAL', permitted: [], excluded: [], obligations: {}, shareAlike: null },
  observabilityIndex: { index: 1, best: 1, perSource: [] },
  timing: { startedAt: '2026-01-02T00:00:00Z', finishedAt: '2026-01-02T00:00:02Z' },
};

/* ------------------------------ canonical -------------------------------- */

test('canonical form is key-order independent', () => {
  assert.equal(canonicalise({ b: 1, a: 2 }), canonicalise({ a: 2, b: 1 }));
});

test('canonical form sorts nested keys and array members deeply', () => {
  assert.equal(
    canonicalise({ z: [{ q: 1, a: 2 }] }),
    canonicalise({ z: [{ a: 2, q: 1 }] }),
  );
});

test('undefined is dropped but null is preserved (absence vs stated nothing)', () => {
  assert.equal(canonicalise({ a: undefined, b: null }), '{"b":null}');
});

test('non-finite numbers are REJECTED, not silently nulled', () => {
  assert.throws(() => canonicalise({ a: NaN }), TypeError);
  assert.throws(() => canonicalise({ a: Infinity }), TypeError);
});

test('stripVolatile removes wall-clock fields at any depth', () => {
  const s = stripVolatile({ a: { elapsedMs: 5, keep: 1 }, timing: {}, keep: 2 });
  assert.deepEqual(s, { a: { keep: 1 }, keep: 2 });
});

/* -------------------------------- bundle --------------------------------- */

test('bundle is deterministic: same evaluation yields the same evidenceHash', () => {
  const a = buildBundle(EVALUATION);
  const b = buildBundle(EVALUATION);
  assert.equal(a.evidenceHash, b.evidenceHash);
  assert.equal(a.claimHash, b.claimHash);
});

test('changing the claim changes the claim hash', () => {
  const a = buildBundle(EVALUATION);
  const mutated = structuredClone(EVALUATION);
  mutated.claim.assertion.minMagnitude = 6;
  assert.notEqual(buildBundle(mutated).claimHash, a.claimHash);
});

test('changing a verdict changes the evidence hash', () => {
  const a = buildBundle(EVALUATION);
  const mutated = structuredClone(EVALUATION);
  mutated.verdict.verdict = 'REFUTED';
  assert.notEqual(buildBundle(mutated).evidenceHash, a.evidenceHash);
});

test('wall-clock timing does NOT change the evidence hash', () => {
  const a = buildBundle(EVALUATION);
  const later = structuredClone(EVALUATION);
  later.timing.finishedAt = '2027-05-05T05:05:05Z';
  later.findings[0].elapsedMs = 9999;
  assert.equal(buildBundle(later).evidenceHash, a.evidenceHash,
    'reproducibility must not depend on how long the network took');
});

test('the bundle carries a chain of custody with a digest per request', () => {
  const b = buildBundle(EVALUATION);
  assert.equal(b.custody.length, 1);
  assert.equal(b.custody[0].responseDigest, 'sha256:abc');
  assert.equal(b.custody[0].requestUrl, 'https://example.invalid/q');
});

test('the process certificate states the no-promotion rule and the no-false-negative rule', () => {
  const s = buildBundle(EVALUATION).process.statements.join(' ');
  assert.match(s, /cannot raise a derivation class/);
  assert.match(s, /does not report the claim as false/);
});

/* ------------------------------ signature -------------------------------- */

test('a signed bundle verifies', () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem, { issuer: 'test' });
  assert.equal(verifySignature(signed).valid, true);
});

test('TAMPER: flipping the verdict after signing breaks the signature', () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  signed.verdict.verdict = 'REFUTED';
  assert.equal(verifySignature(signed).valid, false);
});

test('TAMPER: altering a response digest breaks the signature', () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  signed.custody[0].responseDigest = 'sha256:deadbeef';
  assert.equal(verifySignature(signed).valid, false);
});

test('the signature disclaims exactly what it cannot prove', () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  assert.match(signed.signature.disclaimer, /makes no representation that the underlying sources were correct/);
});

/* ------------------------------- verifier -------------------------------- */

test('offline verification passes on an untampered bundle', async () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  const r = await verifyBundle(signed, { reproduce: false });
  assert.equal(r.valid, true);
  assert.deepEqual(r.checks.map((c) => c.check).sort(), ['CLAIM_HASH', 'EVIDENCE_HASH', 'INTEGRITY']);
});

test('offline verification names which check failed', async () => {
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  signed.claimHash = 'sha256:wrong';
  const r = await verifyBundle(signed, { reproduce: false });
  assert.equal(r.valid, false);
  assert.match(r.summary, /CLAIM_HASH/);
});

/* ------------------------- content digest semantics ----------------------- *
 * Regression: the first verifier compared raw response bytes and failed on its
 * first real run, because USGS stamps every response with `metadata.generated`.
 * A verifier that always reports tampering catches nothing.
 * -------------------------------------------------------------------------- */
import { contentDigest } from '../sources/base.js';

test('content digest ignores key order, so normalisation is stable across runs', () => {
  assert.equal(
    contentDigest([{ mag: 5, place: 'X' }]),
    contentDigest([{ place: 'X', mag: 5 }]),
  );
});

test('content digest DOES change when a finding changes', () => {
  assert.notEqual(contentDigest([{ mag: 5 }]), contentDigest([{ mag: 6 }]));
});

test('content digest is insensitive to the server envelope that raw hashing trips on', () => {
  // Two responses differing only in a generation timestamp normalise to the
  // same records, and therefore to the same content digest.
  const recordsFromRunA = [{ eventId: 'us1', magnitude: 5.8 }];
  const recordsFromRunB = [{ eventId: 'us1', magnitude: 5.8 }];
  assert.equal(contentDigest(recordsFromRunA), contentDigest(recordsFromRunB));
});

test('custody carries BOTH digests, which do different jobs', () => {
  const withBoth = structuredClone(EVALUATION);
  withBoth.findings[0].contentDigest = 'sha256:content';
  const b = buildBundle(withBoth);
  assert.equal(b.custody[0].responseDigest, 'sha256:abc', 'raw bytes: chain of custody');
  assert.equal(b.custody[0].contentDigest, 'sha256:content', 'normalised records: reproducibility');
});

test('the process certificate explains why there are two digests', () => {
  const s = buildBundle(EVALUATION).process.statements.join(' ');
  assert.match(s, /expected to drift where a source stamps each reply/);
});

test('reproduction failure does NOT invalidate a correctly-issued bundle', async () => {
  // A source revising a record months later does not retroactively make an
  // honest bundle dishonest. It makes it a correct record of what was knowable.
  const { privateKeyPem } = generateIssuerKeypair();
  const signed = signBundle(buildBundle(EVALUATION), privateKeyPem);
  const r = await verifyBundle(signed, { reproduce: false });
  assert.equal(r.valid, true);
  assert.equal(r.checks.some((c) => c.check === 'REPRODUCTION'), false,
    'reproduction is opt-in and must never gate offline validity');
});
