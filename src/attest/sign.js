/**
 * Detached ed25519 signature over the canonical bundle.
 *
 * The signature answers "was this bundle altered after issue?" — nothing more.
 * It does NOT make the contents true, and the certificate says so out loud,
 * because a signed lie is the failure mode of every attestation system that
 * oversells its cryptography.
 *
 * @module attest/sign
 */

import { generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey } from 'node:crypto';
import { canonicalise, stripVolatile } from './canonical.js';

export function generateIssuerKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** The exact bytes that get signed. Exported so a verifier can rebuild them. */
export function signingPayload(bundle) {
  const { signature, ...rest } = bundle;
  return canonicalise(stripVolatile(rest));
}

export function signBundle(bundle, privateKeyPem, { issuer = null } = {}) {
  const payload = signingPayload(bundle);
  const sig = edSign(null, Buffer.from(payload, 'utf8'), privateKeyPem);
  return {
    ...bundle,
    signature: {
      algorithm: 'ed25519',
      issuer,
      publicKeyPem: createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' }).toString(),
      value: sig.toString('base64'),
      signedAt: new Date().toISOString(),
      covers: 'canonical bundle excluding wall-clock timings and the signature block itself',
      disclaimer:
        'This signature establishes only that the bundle has not been altered since issue. ' +
        'It makes no representation that the underlying sources were correct.',
    },
  };
}

export function verifySignature(bundle) {
  const sig = bundle.signature;
  if (!sig) return { valid: false, reason: 'no signature block' };
  try {
    const ok = edVerify(
      null,
      Buffer.from(signingPayload(bundle), 'utf8'),
      createPublicKey(sig.publicKeyPem),
      Buffer.from(sig.value, 'base64'),
    );
    return { valid: ok, reason: ok ? 'signature valid' : 'signature does not match bundle contents' };
  } catch (err) {
    return { valid: false, reason: `verification error: ${err.message}` };
  }
}
