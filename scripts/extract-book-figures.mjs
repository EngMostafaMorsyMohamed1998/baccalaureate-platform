import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "booklet", "figures");
const PAINT = new Set();

const LESSONS = [
  ["1-1", 1, 5, 12],
  ["1-2", 1, 13, 19],
  ["1-3", 1, 20, 26],
  ["1-4", 1, 27, 33],
  ["2-1", 1, 34, 41],
  ["2-2", 1, 42, 48],
  ["2-3", 1, 49, 55],
  ["3-1", 1, 56, 62],
  ["3-2", 1, 63, 68],
  ["3-3", 1, 69, 75],
  ["4-1", 1, 76, 81],
  ["4-2", 1, 82, 88],
  ["4-3", 1, 89, 95],
  ["4-4", 1, 96, 104],
  ["5-1", 2, 5, 12],
  ["5-2", 2, 13, 21],
  ["5-3", 2, 22, 29],
  ["6-1", 2, 30, 39],
  ["6-2", 2, 40, 48],
  ["6-3", 2, 49, 57],
  ["7-1", 2, 58, 68],
  ["7-2", 2, 69, 77],
  ["7-3", 2, 78, 88],
];

function isHero(w, h) {
  const ratio = w / h;
  return w >= 1400 && h >= 1400 && ratio > 0.82 && ratio < 1.22;
}

function toRgba(img) {
  const { width, height, data, kind } = img;
  const out = new Uint8ClampedArray(width * height * 4);
  if (kind === 3) {
    out.set(data);
    return out;
  }
  if (kind === 2) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
    return out;
  }
  return null;
}

function toJpeg(img) {
  const rgba = toRgba(img);
  if (!rgba) return null;
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  const tw = Math.max(1, Math.round(img.width * scale));
  const th = Math.max(1, Math.round(img.height * scale));
  const src = createCanvas(img.width, img.height);
  const sctx = src.getContext("2d");
  const pixels = sctx.createImageData(img.width, img.height);
  pixels.data.set(rgba);
  sctx.putImageData(pixels, 0, 0);
  const dest = createCanvas(tw, th);
  dest.getContext("2d").drawImage(src, 0, 0, tw, th);
  return dest.toBuffer("image/jpeg", 74);
}

async function loadPdf(part, locale) {
  const file = path.join(ROOT, "public", "books", `programming-ai-${locale}-part${part}.pdf`);
  const bytes = await readFile(file);
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    verbosity: 0,
  }).promise;
}

async function pageImages(doc, pageNo) {
  if (pageNo < 1 || pageNo > doc.numPages) return [];
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  if (!PAINT.size) {
    PAINT.add(pdfjs.OPS.paintImageXObject);
    PAINT.add(pdfjs.OPS.paintImageXObjectRepeat);
  }
  const seen = new Set();
  const images = [];
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    if (!PAINT.has(ops.fnArray[i])) continue;
    const name = ops.argsArray[i][0];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    try {
      const img = await page.objs.get(name);
      if (!img?.width || img.width < 220 || img.height < 140) continue;
      if (isHero(img.width, img.height)) continue;
      images.push(img);
    } catch {
      /* skip unresolved */
    }
  }
  return images;
}

await rm(OUT, { recursive: true, force: true });
const manifest = { ar: {}, en: {} };

for (const locale of ["en", "ar"]) {
  const docs = {
    1: await loadPdf(1, locale),
    2: await loadPdf(2, locale),
  };
  for (const [id, part, start, end] of LESSONS) {
    const hashes = new Set();
    const files = [];
    for (let pageNo = start; pageNo <= end; pageNo += 1) {
      const images = await pageImages(docs[part], pageNo);
      for (const img of images) {
        const jpeg = toJpeg(img);
        if (!jpeg) continue;
        const hash = createHash("sha1").update(jpeg).digest("hex");
        if (hashes.has(hash)) continue;
        hashes.add(hash);
        const rel = `${locale}/${id}/${files.length}.jpg`;
        const dest = path.join(OUT, rel);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, jpeg);
        files.push(rel);
      }
    }
    manifest[locale][id] = files;
    console.log(`${locale} ${id}: ${files.length}`);
  }
  await docs[1].cleanup?.();
  await docs[2].cleanup?.();
}

await writeFile(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("done", OUT);
