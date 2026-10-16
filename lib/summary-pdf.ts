import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { BRAND } from "@/lib/brand";

const FONT_NAME = "NotoNaskh";
const arabicRe = /[\u0600-\u06FF]/;

let fontReady = false;

function ensureFont() {
  if (fontReady) return;
  GlobalFonts.registerFromPath(path.join(process.cwd(), "fonts/NotoNaskhArabic-Regular.ttf"), FONT_NAME);
  fontReady = true;
}

export type SummarySection = {
  heading: string;
  lines: string[];
};

export type SummaryDocument = {
  locale: "ar" | "en";
  studentName: string;
  courseTitle: string;
  generatedOn: string;
  notesLabel: string;
  sections: SummarySection[];
};

type DrawLine = {
  text: string;
  size: number;
  color: string;
  gap: number;
};

const PAGE_W = 595;
const PAGE_H = 842;
const SCALE = 2;
const MARGIN = 42;
const NOTES_TOP = 730;

function wrap(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, text: string, size: number, width: number): string[] {
  ctx.font = `${size}px ${FONT_NAME}`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function paintPage(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  doc: SummaryDocument,
  lines: DrawLine[],
  pageNo: number,
  pageCount: number,
) {
  const width = PAGE_W * SCALE;
  const height = PAGE_H * SCALE;
  const margin = MARGIN * SCALE;
  const rtl = doc.locale === "ar";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0c2d6b";
  ctx.fillRect(0, 0, width, 18 * SCALE);
  ctx.fillStyle = "#0c2d6b";
  ctx.textBaseline = "top";
  const brand = doc.locale === "ar" ? BRAND.nameAr : BRAND.nameEn;
  const header = [brand, doc.courseTitle, doc.studentName, doc.generatedOn];
  let y = 28 * SCALE;
  header.forEach((text, index) => {
    const size = (index === 0 ? 16 : 11) * SCALE;
    ctx.font = `${size}px ${FONT_NAME}`;
    ctx.fillStyle = index === 0 ? "#0c2d6b" : "#374151";
    ctx.direction = rtl || arabicRe.test(text) ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(text, rtl ? width - margin : margin, y, width - margin * 2);
    y += size + 6 * SCALE;
  });
  y += 8 * SCALE;
  for (const line of lines) {
    const size = line.size * SCALE;
    ctx.font = `${size}px ${FONT_NAME}`;
    ctx.fillStyle = line.color;
    ctx.direction = rtl || arabicRe.test(line.text) ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(line.text, rtl ? width - margin : margin, y, width - margin * 2);
    y += size + line.gap * SCALE;
  }
  const notesY = NOTES_TOP * SCALE;
  ctx.strokeStyle = "#d5deea";
  ctx.beginPath();
  ctx.moveTo(margin, notesY);
  ctx.lineTo(width - margin, notesY);
  ctx.stroke();
  ctx.fillStyle = "#0c2d6b";
  ctx.font = `${12 * SCALE}px ${FONT_NAME}`;
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillText(doc.notesLabel, rtl ? width - margin : margin, notesY + 8 * SCALE);
  ctx.strokeStyle = "#e5e7eb";
  for (let i = 1; i <= 3; i += 1) {
    const lineY = notesY + (18 + i * 16) * SCALE;
    ctx.beginPath();
    ctx.moveTo(margin, lineY);
    ctx.lineTo(width - margin, lineY);
    ctx.stroke();
  }
  ctx.fillStyle = "#6b7280";
  ctx.font = `${10 * SCALE}px ${FONT_NAME}`;
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(String(pageNo), width / 2, height - 24 * SCALE);
  void pageCount;
}

export async function renderSummaryPdf(doc: SummaryDocument): Promise<Uint8Array> {
  ensureFont();
  const measure = createCanvas(PAGE_W * SCALE, PAGE_H * SCALE);
  const measureCtx = measure.getContext("2d");
  const contentWidth = (PAGE_W - MARGIN * 2) * SCALE;
  const pages: DrawLine[][] = [[]];
  let used = 118;
  const push = (line: DrawLine) => {
    const next = used + line.size + line.gap;
    if (next > NOTES_TOP - 16 && pages[pages.length - 1]!.length) {
      pages.push([]);
      used = 118;
    }
    pages[pages.length - 1]!.push(line);
    used += line.size + line.gap;
  };
  for (const section of doc.sections) {
    for (const heading of wrap(measureCtx, section.heading, 15 * SCALE, contentWidth)) {
      push({ text: heading, size: 15, color: "#0c2d6b", gap: 6 });
    }
    for (const raw of section.lines) {
      for (const line of wrap(measureCtx, raw, 12 * SCALE, contentWidth)) {
        push({ text: line, size: 12, color: "#111827", gap: 4 });
      }
    }
    push({ text: " ", size: 8, color: "#111827", gap: 6 });
  }
  if (!pages[0]?.length) pages[0] = [{ text: " ", size: 12, color: "#111827", gap: 4 }];

  const pdf = await PDFDocument.create();
  for (const [index, lines] of pages.entries()) {
    const canvas = createCanvas(PAGE_W * SCALE, PAGE_H * SCALE);
    paintPage(canvas.getContext("2d"), doc, lines, index + 1, pages.length);
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const image = await pdf.embedPng(canvas.toBuffer("image/png"));
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }
  return pdf.save();
}
