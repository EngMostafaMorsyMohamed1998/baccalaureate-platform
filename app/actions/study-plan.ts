"use server";

import { revalidatePath } from "next/cache";
import { cairoDate } from "@/lib/class-clock";
import { getStudentSession } from "@/lib/student-session";
import { parseExamDate, readStudyPlan, writeStudyPlan, type PlanCheck } from "@/lib/study-plan-store";

const TASK = /^(lesson|summary|review):[A-Za-z0-9_.:-]{1,80}$/;

function refresh() {
  revalidatePath("/dashboard/planner");
  revalidatePath("/dashboard/progress");
}

export async function saveStudyExamDate(formData: FormData): Promise<void> {
  const student = await getStudentSession();
  if (!student) return;
  const today = cairoDate();
  const examDate = parseExamDate(String(formData.get("examDate") || ""), today);
  if (!examDate) return;
  const current = await readStudyPlan(student.id);
  await writeStudyPlan({
    studentId: student.id,
    examDate,
    done: current?.done ?? [],
  });
  refresh();
}

export async function togglePlanTask(taskId: string): Promise<void> {
  const student = await getStudentSession();
  if (!student || !TASK.test(taskId)) return;
  const today = cairoDate();
  const current = await readStudyPlan(student.id);
  if (!current) return;
  const exists = current.done.some((row) => row.id === taskId);
  const done: PlanCheck[] = exists
    ? current.done.filter((row) => row.id !== taskId)
    : [...current.done, { id: taskId, date: today }].slice(-400);
  await writeStudyPlan({ studentId: student.id, examDate: current.examDate, done });
  refresh();
}
