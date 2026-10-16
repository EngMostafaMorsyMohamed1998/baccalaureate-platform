import { cairoClock, cairoDate, parseExamChapter } from "@/lib/class-clock";
import { CHAPTERS } from "@/lib/curriculum";
import { passedObjective } from "@/lib/chapter-progress";

export type ActivityInput = {
  attendance: { date: string; present: boolean }[];
  homework: { score: number; total: number; submittedAt: string; lessonId: string }[];
  exams: { chapterId: string; objectiveScore: number; objectiveTotal: number; submittedAt: string }[];
  clearedReviews: number;
  planDates?: string[];
};

export type BadgeId = "ai" | "ml" | "night" | "streak" | "perfect" | "drill";

export type EarnedBadge = {
  id: BadgeId;
  earned: boolean;
};

export function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachIsoDate(start: string, end: string, limit = 120): string[] {
  if (!start || !end || end < start) return start ? [start] : [];
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < limit) {
    dates.push(cursor);
    cursor = shiftIso(cursor, 1);
  }
  return dates;
}

function hourOf(iso: string): number {
  const clock = cairoClock(iso);
  const hour = Number(clock.slice(0, 2));
  return Number.isFinite(hour) ? hour : 12;
}

export function activityDates(input: ActivityInput, today = cairoDate()): Set<string> {
  const dates = new Set<string>();
  for (const row of input.attendance) {
    if (row.present && row.date) dates.add(row.date);
  }
  for (const row of input.homework) {
    if (row.submittedAt) dates.add(cairoDate(new Date(row.submittedAt)));
  }
  for (const row of input.exams) {
    if (row.submittedAt) dates.add(cairoDate(new Date(row.submittedAt)));
  }
  for (const date of input.planDates ?? []) {
    if (date && date <= today) dates.add(date);
  }
  return dates;
}

export function currentStreak(dates: Set<string>, today = cairoDate()): number {
  let cursor = dates.has(today) ? today : shiftIso(today, -1);
  let streak = 0;
  while (dates.has(cursor) && streak < 400) {
    streak += 1;
    cursor = shiftIso(cursor, -1);
  }
  return streak;
}

function passedChapterIds(exams: ActivityInput["exams"]): Set<string> {
  const found = new Set<string>();
  for (const exam of exams) {
    const chapterId = parseExamChapter(exam.chapterId).chapterId;
    if (passedObjective(exam.objectiveScore, exam.objectiveTotal)) found.add(chapterId);
  }
  return found;
}

export function chapterPercent(completed: Iterable<string>): number {
  const done = new Set(completed);
  const count = CHAPTERS.filter((chapter) => done.has(chapter.id)).length;
  return Math.round((count / CHAPTERS.length) * 100);
}

export function examPercent(exams: ActivityInput["exams"]): number {
  const passed = passedChapterIds(exams);
  const count = CHAPTERS.filter((chapter) => passed.has(chapter.id)).length;
  return Math.round((count / CHAPTERS.length) * 100);
}

export function buildBadges(input: ActivityInput, completed: Iterable<string>, streak: number): EarnedBadge[] {
  const done = new Set(completed);
  const perfectHomework = input.homework.some((row) => row.total > 0 && row.score === row.total);
  const perfectExam = input.exams.some(
    (row) => row.objectiveTotal > 0 && row.objectiveScore === row.objectiveTotal,
  );
  const night = [...input.homework, ...input.exams].some((row) => {
    const hour = hourOf(row.submittedAt);
    return hour >= 22 || hour < 5;
  });
  return [
    { id: "ai", earned: done.has("1") },
    { id: "ml", earned: done.has("7") },
    { id: "night", earned: night },
    { id: "streak", earned: streak >= 7 },
    { id: "perfect", earned: perfectHomework || perfectExam },
    { id: "drill", earned: input.clearedReviews > 0 },
  ];
}
