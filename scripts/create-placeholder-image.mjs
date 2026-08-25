import fs from "node:fs";
import zlib from "node:zlib";

const width = 720;
const height = 520;
const raw = Buffer.alloc((width * 4 + 1) * height);
const pngPath = new URL("../static/images/profile.png", import.meta.url);

const clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const row = y * (width * 4 + 1);
  const i = row + 1 + x * 4;
  raw[i] = clamp(r);
  raw[i + 1] = clamp(g);
  raw[i + 2] = clamp(b);
  raw[i + 3] = clamp(a);
}

function blendPixel(x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const row = y * (width * 4 + 1);
  const i = row + 1 + x * 4;
  raw[i] = clamp(raw[i] * (1 - alpha) + r * alpha);
  raw[i + 1] = clamp(raw[i + 1] * (1 - alpha) + g * alpha);
  raw[i + 2] = clamp(raw[i + 2] * (1 - alpha) + b * alpha);
  raw[i + 3] = 255;
}

function fillCircle(cx, cy, radius, color) {
  const [r, g, b, a = 255] = color;
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

function thickLine(x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness / 2, color);
  }
}

function fillRect(x1, y1, x2, y2, color) {
  const [r, g, b, a = 255] = color;
  for (let y = Math.max(0, y1); y < Math.min(height, y2); y++) {
    for (let x = Math.max(0, x1); x < Math.min(width, x2); x++) {
      setPixel(x, y, r, g, b, a);
    }
  }
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

for (let y = 0; y < height; y++) {
  raw[y * (width * 4 + 1)] = 0;
  const t = y / (height - 1);
  for (let x = 0; x < width; x++) {
    const dx = (x - width / 2) / width;
    const vignette = Math.max(0, 1 - Math.sqrt(dx * dx + (t - 0.45) ** 2) * 1.25);
    const r = 8 + 25 * (1 - t) + 10 * vignette;
    const g = 12 + 27 * (1 - t) + 8 * vignette;
    const b = 19 + 44 * (1 - t) + 16 * vignette;
    setPixel(x, y, r, g, b);
  }
}

const random = lcg(20250525);
for (let i = 0; i < 1050; i++) {
  const x = Math.floor(random() * width);
  const y = Math.floor(random() * height * 0.72);
  const size = random() > 0.94 ? 1.6 : 0.85;
  const glow = random() * 0.55 + 0.35;
  blendPixel(x, y, 235, 239, 245, glow);
  if (size > 1) {
    blendPixel(x + 1, y, 210, 220, 240, 0.25);
    blendPixel(x - 1, y, 210, 220, 240, 0.25);
    blendPixel(x, y + 1, 210, 220, 240, 0.2);
  }
}

for (let y = 360; y < height; y++) {
  const ridge = 438 + Math.sin(y / 19) * 6;
  for (let x = 0; x < width; x++) {
    const slope = 455 - 0.07 * x + Math.sin(x / 42) * 14;
    if (y > Math.min(ridge, slope)) setPixel(x, y, 3, 5, 7);
  }
}

const black = [2, 3, 4, 255];
thickLine(540, 455, 545, 295, 34, black);
thickLine(543, 333, 475, 270, 17, black);
thickLine(550, 326, 630, 268, 18, black);
thickLine(553, 385, 650, 348, 16, black);
thickLine(475, 270, 435, 250, 12, black);
thickLine(630, 268, 665, 235, 12, black);
thickLine(650, 348, 688, 328, 11, black);

for (const [cx, cy, radius] of [
  [432, 246, 34],
  [478, 274, 30],
  [626, 268, 36],
  [666, 232, 30],
  [650, 351, 34],
  [691, 328, 28],
  [552, 292, 28],
]) {
  fillCircle(cx, cy, radius, black);
  thickLine(cx - radius, cy, cx + radius, cy, 6, black);
  thickLine(cx, cy - radius, cx, cy + radius, 6, black);
}

fillCircle(185, 356, 18, black);
thickLine(184, 374, 166, 430, 17, black);
thickLine(169, 428, 126, 462, 14, black);
thickLine(169, 430, 220, 463, 14, black);
thickLine(176, 397, 135, 384, 10, black);
thickLine(176, 397, 211, 390, 10, black);
fillRect(0, 468, width, height, black);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync(new URL("../static/images/", import.meta.url), { recursive: true });
fs.writeFileSync(pngPath, png);
console.log(`Wrote ${pngPath.pathname}`);
