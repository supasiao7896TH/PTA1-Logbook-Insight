import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ICONS_DIR = path.resolve('public', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 1. Generate SVG Icons
const createSvgIcon = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
  </defs>
  <!-- Background with subtle border -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#brandGrad)" />
  <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${Math.round(size * 0.22) - 2}" fill="none" stroke="#60A5FA" stroke-width="3" opacity="0.4" />
  
  <!-- Stylized PTA Plant / Chart graphic -->
  <g transform="translate(${size * 0.18}, ${size * 0.16}) scale(${size / 100 * 0.64})">
    <!-- Plant tower silhouette / Bars -->
    <rect x="8" y="45" width="16" height="45" rx="3" fill="#DBEAFE" opacity="0.9" />
    <rect x="30" y="25" width="16" height="65" rx="3" fill="#FFFFFF" />
    <rect x="52" y="38" width="16" height="52" rx="3" fill="#93C5FD" opacity="0.9" />
    <rect x="74" y="15" width="16" height="75" rx="3" fill="#FFFFFF" />
    
    <!-- Top connector / Antenna -->
    <line x1="38" y1="10" x2="38" y2="25" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
    <circle cx="38" cy="8" r="4" fill="url(#amberGrad)" />
    
    <!-- Lightning spark / Insight symbol -->
    <path d="M72 10 L84 25 L76 25 L86 42 L68 28 L76 28 Z" fill="url(#amberGrad)" stroke="#78530A" stroke-width="1.5" />
  </g>

  <!-- Text Badge -->
  <text x="${size / 2}" y="${Math.round(size * 0.86)}" font-family="system-ui, -apple-system, 'Noto Sans Thai', sans-serif" font-weight="800" font-size="${Math.round(size * 0.15)}" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">PTA1</text>
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.svg'), createSvgIcon(192));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.svg'), createSvgIcon(512));
console.log('Created icon-192.svg and icon-512.svg');

// 2. Pure Node PNG Generator (using CRC32 + zlib deflate)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(len, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width, height, bit depth (8), color type (6 = RGBA), compression (0), filter (0), interlace (0)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // 8 bits per channel
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Uncompressed scanlines: each line has 1 filter byte (0 = None) + size * 4 bytes RGBA
  const rawData = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;

  // Design: Rounded rect in Ink Blue (#1D4ED8: 29, 78, 216), Amber accent (#F59E0B: 245, 158, 11)
  const radius = Math.floor(size * 0.22);
  const r2 = radius * radius;

  for (let y = 0; y < size; y++) {
    rawData[offset++] = 0; // Filter byte: None

    for (let x = 0; x < size; x++) {
      // Check rounded corner mask
      let inCorner = false;
      let distSq = 0;
      if (x < radius && y < radius) {
        distSq = (radius - x) ** 2 + (radius - y) ** 2;
        inCorner = distSq > r2;
      } else if (x >= size - radius && y < radius) {
        distSq = (x - (size - 1 - radius)) ** 2 + (radius - y) ** 2;
        inCorner = distSq > r2;
      } else if (x < radius && y >= size - radius) {
        distSq = (radius - x) ** 2 + (y - (size - 1 - radius)) ** 2;
        inCorner = distSq > r2;
      } else if (x >= size - radius && y >= size - radius) {
        distSq = (x - (size - 1 - radius)) ** 2 + (y - (size - 1 - radius)) ** 2;
        inCorner = distSq > r2;
      }

      if (inCorner) {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0; // Transparent
        continue;
      }

      // Default background: Gradient from #2563EB to #1D4ED8
      const t = y / size;
      let r = Math.round(37 * (1 - t) + 29 * t);
      let g = Math.round(99 * (1 - t) + 78 * t);
      let b = Math.round(235 * (1 - t) + 216 * t);
      let a = 255;

      // Draw bars / analytics chart in center
      // Bar 1
      if (x >= size * 0.22 && x <= size * 0.32 && y >= size * 0.45 && y <= size * 0.72) {
        r = 219; g = 234; b = 254; // #DBEAFE
      }
      // Bar 2 (tallest)
      else if (x >= size * 0.36 && x <= size * 0.46 && y >= size * 0.28 && y <= size * 0.72) {
        r = 255; g = 255; b = 255; // White
      }
      // Bar 3
      else if (x >= size * 0.50 && x <= size * 0.60 && y >= size * 0.38 && y <= size * 0.72) {
        r = 147; g = 197; b = 253; // #93C5FD
      }
      // Bar 4 (high)
      else if (x >= size * 0.64 && x <= size * 0.74 && y >= size * 0.20 && y <= size * 0.72) {
        r = 255; g = 255; b = 255; // White
      }
      // Amber spark dot above bar 2
      else if ((x - size * 0.41) ** 2 + (y - size * 0.20) ** 2 <= (size * 0.04) ** 2) {
        r = 245; g = 158; b = 11; // #F59E0B Amber
      }
      // Amber spark badge top right
      else if (x >= size * 0.68 && x <= size * 0.78 && y >= size * 0.12 && y <= size * 0.22) {
        r = 252; g = 211; b = 77; // #FCD34D
      }
      // Subtitle line at bottom
      else if (y >= size * 0.80 && y <= size * 0.83 && x >= size * 0.25 && x <= size * 0.75) {
        r = 255; g = 255; b = 255;
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), generatePng(512));
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), generatePng(180));
console.log('Created valid PNG icons: icon-192.png, icon-512.png, apple-touch-icon.png');
