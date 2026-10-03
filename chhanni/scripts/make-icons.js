/**
 * Generates the extension icons.
 *
 * The Chrome Web Store will not accept a listing without a 128x128 icon, and
 * an extension with no `icons` key shows a grey jigsaw piece in the toolbar —
 * which is a poor look for something whose whole job is to be trusted.
 *
 * These are drawn here rather than committed as opaque binaries so the mark is
 * reviewable: it is a sieve, seen from above. A ring, and a grid of holes with
 * one of them caught. Written with node:zlib and a hand-rolled PNG writer
 * because the project has no dependencies and this is not a good reason to
 * acquire the first one.
 *
 * This is a functional mark, not a designed brand. Replace it when there is one.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRC = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = (c >>> 8) ^ CRC[(c ^ b) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {(x:number,y:number)=>[number,number,number,number]} shade */
function png(size, shade) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = shade(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const INK = [20, 24, 31];        // the body of the sieve
const CAUGHT = [209, 73, 91];    // the one thing it stopped

/**
 * Supersampled so the curves survive at 16px. Everything is in units of the
 * icon's own width, so one description draws every size.
 */
function sieve(size) {
  const S = 4; // samples per axis
  return (px, py) => {
    let ink = 0, caught = 0, n = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) / size - 0.5;
        const y = (py + (sy + 0.5) / S) / size - 0.5;
        const r = Math.hypot(x, y);
        n++;
        // The rim.
        if (r < 0.46 && r > 0.38) { ink++; continue; }
        if (r >= 0.38) continue;
        // The mesh: holes on a 5x5 lattice, so the gaps read as a sieve.
        const step = 0.155;
        const gx = Math.round(x / step), gy = Math.round(y / step);
        const hole = Math.hypot(x - gx * step, y - gy * step) < 0.052;
        if (!hole) { ink++; continue; }
        // One hole is plugged: the grain the sieve caught.
        if (gx === 1 && gy === -1) caught++;
      }
    }
    if (caught > ink && caught > 0) return [...CAUGHT, Math.round(255 * caught / n)];
    return [...INK, Math.round(255 * ink / n)];
  };
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');
mkdirSync(out, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(out, `${size}.png`), png(size, sieve(size)));
}
console.log('chhanni: wrote extension/icons/{16,32,48,128}.png');
