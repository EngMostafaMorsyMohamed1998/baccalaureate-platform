import { readFile } from "node:fs/promises";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const file = process.argv[2] ?? "public/books/programming-ai-en-part1.pdf";
const from = Number(process.argv[3] ?? 1);
const to = Number(process.argv[4] ?? 40);
const bytes = await readFile(file);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(bytes),
  disableFontFace: true,
  isOffscreenCanvasSupported: false,
  verbosity: 0,
}).promise;

const paint = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintImageXObjectRepeat]);
let total = 0;

for (let pageNo = from; pageNo <= Math.min(to, doc.numPages); pageNo += 1) {
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  const seen = new Set();
  let count = 0;
  let maxW = 0;
  let maxH = 0;
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    if (!paint.has(ops.fnArray[i])) continue;
    const name = ops.argsArray[i][0];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    try {
      const img = await page.objs.get(name);
      if (!img?.width || img.width < 80 || img.height < 80) continue;
      count += 1;
      maxW = Math.max(maxW, img.width);
      maxH = Math.max(maxH, img.height);
    } catch {
      /* skip */
    }
  }
  if (count) {
    total += count;
    console.log(`p${pageNo}\t${count}\tmax ${maxW}x${maxH}`);
  }
}

console.log(`total large images: ${total} / pages ${doc.numPages}`);
await doc.cleanup?.();
