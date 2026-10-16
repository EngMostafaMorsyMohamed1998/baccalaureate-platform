import { BookletCatalog } from "./booklet-catalog";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function BookletPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; solutions?: string }>;
}) {
  const locale = await getLocale();
  const { lesson, solutions } = await searchParams;
  return <BookletCatalog locale={locale} initialLessonId={lesson} openSolutions={solutions === "1"} />;
}
