// src/lib/milestone/harness/baselines.ts — PNG dimensio + pixel-diff % (pure; 8.2.3 baselines & regression)
// Kazi: (1) soma PNG bytes, (2) tumia dims, (3) decode RGBA (zlib inflate — stdlib ya Node),
// (4) hesabu pixels zilizobadilika zaidi ya threshold % (pixelmatch-style, lakini ndani-yetu).

import { inflateSync } from "node:zlib";

export interface PngImage { width: number; height: number; rgba: Uint8Array; }

/** PNG header kama bytes? (validate ya haraka). */
export function isPng(buf: Uint8Array): boolean {
  if (buf.length < 8) return false;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return false;
  return true;
}

/** Punguza PNG chunks: { IHDR dims, IDAT data }. */
function pngChunks(buf: Uint8Array): { width: number; height: number; bitDepth: number; colorType: number; idat: Uint8Array[]; plte?: Uint8Array; trns?: Uint8Array } {
  if (!isPng(buf)) throw new Error("si PNG halali (signature)");
  let off = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6;
  const idat: Uint8Array[] = [];
  let plte: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  while (off < buf.length) {
    const len = (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IEND") break;
    off += 12 + len;
  }
  return { width, height, bitDepth, colorType, idat, plte, trns };
}

const BYPP: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Scanline filter 0–4 reversal. */
function unfilter(raw: Uint8Array, width: number, height: number, bypp: number): Uint8Array {
  const stride = width * bypp;
  const out = new Uint8Array(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++];
      const a = x >= bypp ? row[x - bypp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bypp && prev ? prev[x - bypp] : 0;
      switch (filter) {
        case 0: row[x] = v; break;
        case 1: row[x] = (v + a) & 0xff; break;
        case 2: row[x] = (v + b) & 0xff; break;
        case 3: row[x] = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          row[x] = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`filter isiyojulikana ${filter}`);
      }
    }
  }
  return out;
}

/** Decode PNG → RGBA (8-bit only; grayscale/palette/RGB/a decode). */
export function decodePng(buf: Uint8Array): PngImage {
  const c = pngChunks(buf);
  if (c.bitDepth !== 8) throw new Error(`bitDepth ${c.bitDepth} haijatungwa (8 tu)`);
  const bypp = BYPP[c.colorType];
  if (!bypp) throw new Error(`colorType ${c.colorType} haijatungwa`);
  const joined = new Uint8Array(c.idat.reduce((n, d) => n + d.length, 0));
  let p = 0;
  for (const d of c.idat) { joined.set(d, p); p += d.length; }
  const raw = inflateSync(joined);
  const pix = unfilter(raw, c.width, c.height, bypp);
  const out = new Uint8Array(c.width * c.height * 4);
  const n = c.width * c.height;
  for (let i = 0; i < n; i++) {
    if (c.colorType === 6) { out.set(pix.subarray(i * 4, i * 4 + 4), i * 4); }
    else if (c.colorType === 2) {
      out[i * 4] = pix[i * 3]; out[i * 4 + 1] = pix[i * 3 + 1]; out[i * 4 + 2] = pix[i * 3 + 2]; out[i * 4 + 3] = 255;
    } else if (c.colorType === 0) {
      const g = pix[i]; out[i * 4] = g; out[i * 4 + 1] = g; out[i * 4 + 2] = g; out[i * 4 + 3] = 255;
    } else if (c.colorType === 4) {
      const g = pix[i * 2]; out[i * 4] = g; out[i * 4 + 1] = g; out[i * 4 + 2] = g; out[i * 4 + 3] = pix[i * 2 + 1];
    } else if (c.colorType === 3) {
      const idx = pix[i];
      const r = c.plte ? c.plte[idx * 3] : 0, g = c.plte ? c.plte[idx * 3 + 1] : 0, b = c.plte ? c.plte[idx * 3 + 2] : 0;
      const a = c.trns && idx < c.trns.length ? c.trns[idx] : 255;
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
    }
  }
  return { width: c.width, height: c.height, rgba: out };
}

/** tofauti ya % ya pixels kutoka image mbili — dims changes zinahisabiwa 100% kwa sehemu inayokosekana. */
export function pixelDiffPct(a: PngImage | Uint8Array, b: PngImage | Uint8Array, sensitivity = 0.1): number {
  const ia: PngImage = a instanceof Uint8Array ? decodePng(a) : a;
  const ib: PngImage = b instanceof Uint8Array ? decodePng(b) : b;
  const w = Math.max(ia.width, ib.width);
  const h = Math.max(ia.height, ib.height);
  if (!w || !h) return 0;
  let changed = 0;
  const total = w * h;
  const sa = ia.width * ia.height * 4;
  const sb = ib.width * ib.height * 4;
  if (ia.width === ib.width && ia.height === ib.height && ia.rgba.length === sa && ib.rgba.length === sb) {
    for (let i = 0; i < sa; i += 4) {
      const dr = Math.abs(ia.rgba[i] - ib.rgba[i]);
      const dg = Math.abs(ia.rgba[i + 1] - ib.rgba[i + 1]);
      const db = Math.abs(ia.rgba[i + 2] - ib.rgba[i + 2]);
      const dd = Math.max(dr, dg, db) / 255;
      if (dd > sensitivity) changed++;
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inA = x < ia.width && y < ia.height;
        const inB = x < ib.width && y < ib.height;
        if (!inA || !inB) { changed++; continue; }
        const pa = (y * ia.width + x) * 4;
        const pb = (y * ib.width + x) * 4;
        const dd = Math.max(
          Math.abs(ia.rgba[pa] - ib.rgba[pb]),
          Math.abs(ia.rgba[pa + 1] - ib.rgba[pb + 1]),
          Math.abs(ia.rgba[pa + 2] - ib.rgba[pb + 2]),
        ) / 255;
        if (dd > sensitivity) changed++;
      }
    }
  }
  return (changed / total) * 100;
}
