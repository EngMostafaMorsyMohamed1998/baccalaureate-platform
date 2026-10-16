import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export type PlanCheck = {
  id: string;
  date: string;
};

export type StudyPlanRecord = {
  studentId: string;
  examDate: string;
  done: PlanCheck[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TASK = /^(lesson|summary|review):[A-Za-z0-9_.:-]{1,80}$/;

function localPath(): string {
  return path.join(process.cwd(), "data", "study-plans.json");
}

function asChecks(value: unknown): PlanCheck[] {
  if (!Array.isArray(value)) return [];
  const rows: PlanCheck[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as PlanCheck;
    if (!TASK.test(row.id) || !DATE.test(row.date)) continue;
    rows.push({ id: row.id, date: row.date });
    if (rows.length >= 400) break;
  }
  return rows;
}

export function parseExamDate(value: string, today: string): string | null {
  if (!DATE.test(value)) return null;
  if (value < today) return today;
  const [year, month, day] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year || 0, (month || 1) - 1, day || 1));
  const start = new Date(`${today}T00:00:00Z`);
  const span = (end.getTime() - start.getTime()) / 86_400_000;
  if (span > 180) return null;
  return value;
}

async function ensureTable(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClassStudyPlan" (
        "studentId" TEXT PRIMARY KEY,
        "examDate" TEXT NOT NULL,
        "done" TEXT NOT NULL DEFAULT '[]',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return true;
  } catch {
    return false;
  }
}

async function readLocal(): Promise<StudyPlanRecord[]> {
  try {
    const raw = await readFile(localPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as StudyPlanRecord;
      if (!row.studentId || !DATE.test(row.examDate)) return [];
      return [{ studentId: row.studentId, examDate: row.examDate, done: asChecks(row.done) }];
    });
  } catch {
    return [];
  }
}

async function writeLocal(rows: StudyPlanRecord[]): Promise<void> {
  const filePath = localPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(rows), "utf8");
}

export async function readStudyPlan(studentId: string): Promise<StudyPlanRecord | null> {
  if (await ensureTable()) {
    try {
      const rows = await prisma.$queryRaw<Array<{ studentId: string; examDate: string; done: string }>>`
        SELECT "studentId", "examDate", "done" FROM "ClassStudyPlan" WHERE "studentId" = ${studentId} LIMIT 1
      `;
      const row = rows[0];
      if (row) {
        let done: unknown = [];
        try {
          done = JSON.parse(row.done);
        } catch {
          done = [];
        }
        return { studentId: row.studentId, examDate: row.examDate, done: asChecks(done) };
      }
    } catch {
      // Fall through to the local file when the database is offline.
    }
  }
  return (await readLocal()).find((row) => row.studentId === studentId) ?? null;
}

export async function writeStudyPlan(record: StudyPlanRecord): Promise<void> {
  const done = JSON.stringify(asChecks(record.done));
  const local = await readLocal();
  const next = local.filter((row) => row.studentId !== record.studentId);
  next.push({ studentId: record.studentId, examDate: record.examDate, done: asChecks(record.done) });
  try {
    await writeLocal(next);
  } catch {
    // A read-only disk still leaves the database write below.
  }
  if (!(await ensureTable())) return;
  await prisma.$executeRaw`
    INSERT INTO "ClassStudyPlan" ("studentId", "examDate", "done", "updatedAt")
    VALUES (${record.studentId}, ${record.examDate}, ${done}, CURRENT_TIMESTAMP)
    ON CONFLICT ("studentId") DO UPDATE
    SET "examDate" = EXCLUDED."examDate", "done" = EXCLUDED."done", "updatedAt" = CURRENT_TIMESTAMP
  `;
}
