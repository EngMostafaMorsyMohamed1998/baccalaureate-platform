import { CHAPTERS, lessonTitle } from "@/lib/curriculum";
import { eachIsoDate } from "@/lib/engagement";
import type { Locale } from "@/lib/locale";

export type PlanKind = "lesson" | "summary" | "review";

export type PlanTask = {
  id: string;
  kind: PlanKind;
  title: string;
  minutes: number;
  href: string;
  done: boolean;
};

export type PlanDay = {
  date: string;
  minutes: number;
  tasks: PlanTask[];
};

const DAY_LIMIT_MINUTES = 90;

export function lessonMinutes(chapterId: string): number {
  const chapter = Number(chapterId);
  if (chapter <= 2) return 25;
  if (chapter <= 4) return 35;
  return 45;
}

export function buildPlanTasks(input: {
  locale: Locale;
  passedLessonIds: Set<string>;
  openReviews: { questionKey: string; prompt: string }[];
  doneIds: Set<string>;
}): PlanTask[] {
  const tasks: PlanTask[] = [];
  for (const chapter of CHAPTERS) {
    for (const lesson of chapter.lessons) {
      const title = lessonTitle(lesson, input.locale);
      const lessonDone = input.passedLessonIds.has(lesson.id) || input.doneIds.has(`lesson:${lesson.id}`);
      tasks.push({
        id: `lesson:${lesson.id}`,
        kind: "lesson",
        title,
        minutes: lessonMinutes(chapter.id),
        href: `/dashboard/homework/${lesson.id}`,
        done: lessonDone,
      });
      tasks.push({
        id: `summary:${lesson.id}`,
        kind: "summary",
        title,
        minutes: 15,
        href: "/dashboard/booklet",
        done: input.doneIds.has(`summary:${lesson.id}`),
      });
    }
  }
  for (const review of input.openReviews) {
    tasks.push({
      id: `review:${review.questionKey}`,
      kind: "review",
      title: review.prompt,
      minutes: 10,
      href: "/dashboard/review",
      done: input.doneIds.has(`review:${review.questionKey}`),
    });
  }
  return tasks.filter((task) => task.kind === "summary" || task.kind === "review" || !input.passedLessonIds.has(task.id.slice(7)));
}

export function scheduleTasks(tasks: PlanTask[], today: string, examDate: string): {
  days: PlanDay[];
  overload: boolean;
  dailyBudget: number;
} {
  const open = tasks.filter((task) => !task.done);
  const span = eachIsoDate(today, examDate);
  const total = open.reduce((sum, task) => sum + task.minutes, 0);
  const dailyBudget = Math.max(30, Math.ceil(total / Math.max(1, span.length)));
  const cap = Math.max(DAY_LIMIT_MINUTES, dailyBudget);
  const days: PlanDay[] = span.map((date) => ({ date, minutes: 0, tasks: [] }));
  let index = 0;
  for (const task of open) {
    while (index < days.length - 1 && days[index]!.minutes + task.minutes > cap) index += 1;
    const day = days[index] ?? days[days.length - 1]!;
    day.tasks.push(task);
    day.minutes += task.minutes;
  }
  return {
    days: days.filter((day) => day.tasks.length > 0),
    overload: dailyBudget > DAY_LIMIT_MINUTES,
    dailyBudget,
  };
}
