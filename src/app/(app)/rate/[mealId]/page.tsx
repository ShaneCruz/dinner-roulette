import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { plannedMeal, recipe } from "@/db/schema";
import { say } from "@/lib/copy";
import { eatersFor, loadEaterContext } from "@/lib/plan/store";
import { formatDay } from "@/lib/plan/week";
import { ratingsForMeal } from "@/lib/ratings/store";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { RateForm } from "./rate-form";

export const metadata = { title: "How was dinner?" };

export default async function RatePage({ params }: PageProps<"/rate/[mealId]">) {
  const { acting } = await requireActingMember();
  const { mealId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(mealId)) notFound();

  const [meal] = await db
    .select({
      id: plannedMeal.id,
      date: plannedMeal.date,
      eaterIds: plannedMeal.eaterIds,
      status: plannedMeal.status,
      title: recipe.title,
      slug: recipe.slug,
    })
    .from(plannedMeal)
    .innerJoin(recipe, eq(recipe.id, plannedMeal.recipeId))
    .where(eq(plannedMeal.id, mealId))
    .limit(1);
  if (!meal) notFound();

  const [members, context, existing] = await Promise.all([
    getActiveMembers(),
    loadEaterContext(db, meal.date, meal.date),
    ratingsForMeal(db, meal.id),
  ]);
  const eaterIds = new Set(eatersFor(context, meal.date, meal.eaterIds).map((m) => m.id));
  const isParent = acting.role === "parent";
  const people = members
    .filter((m) => eaterIds.has(m.id))
    .filter((m) => isParent || m.id === acting.id)
    .map((m) => {
      const saved = existing.find((r) => r.memberId === m.id);
      return {
        id: m.id,
        name: m.name,
        emoji: m.avatarEmoji,
        color: m.avatarColor,
        stars: saved?.stars ?? null,
        reasons: saved?.reasons ?? [],
        note: saved?.note ?? "",
      };
    });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Tonight
      </Link>
      <PageHeader
        title={`How was ${meal.title}?`}
        subtitle={`${formatDay(meal.date, "long")} · ${
          isParent ? "Rate for everyone at the table, or pass the phone around." : say("rateAsk", acting.humorDial)
        }`}
      />
      {people.length ? (
        <RateForm mealId={meal.id} people={people} humor={acting.humorDial} />
      ) : (
        <p className="py-8 text-center text-muted">You weren&apos;t at this dinner, so there&apos;s nothing to rate.</p>
      )}
    </div>
  );
}
