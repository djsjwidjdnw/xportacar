// Pure-Node PWA icon generator — no native deps.  Renders a flat blue square
// with a bold white "X" using a tiny PNG encoder.  Run once; outputs go to
// public/icons/.
//
//   node scripts/gen-icons.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

// --- Tiny PNG encoder -------------------------------------------------
// Writes a true-colour-with-alpha (RGBA) PNG from a Uint8Array buffer of
// width*height*4 bytes.  No external dep needed.

function crc32(buf) {
  let c;
  const table = (crc32._t ||= (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // colour type: truecolour + alpha
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // Add per-row filter byte (0 = None).
  const rowBytes = width * 4;
  const filtered = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowBytes + 1)] = 0;
    rgba.copy(filtered, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idatBody = zlib.deflateSync(filtered, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatBody),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Draw helpers -----------------------------------------------------

const BRAND = { r: 0x15, g: 0x70, b: 0xEF };  // #1570EF
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = Math.floor(size * 0.18);            // rounded square
  const cornerR2 = radius * radius;
  const inner = size - radius;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      // Rounded-rectangle hit-test.
      const inCornerTL = x < radius && y < radius;
      const inCornerTR = x >= inner && y < radius;
      const inCornerBL = x < radius && y >= inner;
      const inCornerBR = x >= inner && y >= inner;
      if (inCornerTL) inside = (x - radius) ** 2 + (y - radius) ** 2 <= cornerR2;
      if (inCornerTR) inside = (x - inner + 1) ** 2 + (y - radius) ** 2 <= cornerR2;
      if (inCornerBL) inside = (x - radius) ** 2 + (y - inner + 1) ** 2 <= cornerR2;
      if (inCornerBR) inside = (x - inner + 1) ** 2 + (y - inner + 1) ** 2 <= cornerR2;

      const offset = (y * size + x) * 4;
      if (!inside) {
        buf[offset]     = 0;
        buf[offset + 1] = 0;
        buf[offset + 2] = 0;
        buf[offset + 3] = 0;
        continue;
      }

      // Draw a bold "X" centred in the icon.  The strokes are 16 % of the
      // icon wide and live in the middle 60 % of the icon.
      const margin = Math.floor(size * 0.20);
      const stroke = Math.floor(size * 0.12);
      const inDiag1 = Math.abs((x - margin) - (y - margin)) <= stroke / 2;
      const inDiag2 = Math.abs((x - margin) - (size - margin - 1 - y)) <= stroke / 2;
      const insideXBox = x >= margin && x <= size - margin && y >= margin && y <= size - margin;
      const isStroke = insideXBox && (inDiag1 || inDiag2);

      const c = isStroke ? WHITE : BRAND;
      buf[offset]     = c.r;
      buf[offset + 1] = c.g;
      buf[offset + 2] = c.b;
      buf[offset + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

for (const size of [192, 512]) {
  const png = makeIcon(size);
  const out = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ wrote ${out}  (${png.length.toLocaleString()} bytes)`);
}

// Also produce a favicon-sized icon for completeness.
writeFileSync(join(OUT_DIR, "icon-48.png"), makeIcon(48));
console.log("done.");
