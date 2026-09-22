import { and, desc, eq, gte, inArray } from "drizzle-orm";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { plannedMeal, rating, recipe } from "@/db/schema";
import { NIGHT_TYPES, formatDay } from "@/lib/plan/week";
import { addDays, todayIn } from "@/lib/presence";
import { faceFor } from "@/lib/ratings/scale";
import { getActiveMembers, requireActingMember } from "@/lib/session";

export const metadata = { title: "Dinner history" };

export default async function HistoryPage() {
  const { settings } = await requireActingMember();
  const since = addDays(todayIn(settings.timezone), -120);
  const meals = await db
    .select({
      id: plannedMeal.id,
      date: plannedMeal.date,
      nightType: plannedMeal.nightType,
      status: plannedMeal.status,
      title: recipe.title,
      slug: recipe.slug,
    })
    .from(plannedMeal)
    .leftJoin(recipe, eq(recipe.id, plannedMeal.recipeId))
    .where(and(gte(plannedMeal.date, since), inArray(plannedMeal.status, ["cooked"])))
    .orderBy(desc(plannedMeal.date));
  const [ratings, members] = await Promise.all([
    meals.length
      ? db.select().from(rating).where(inArray(rating.plannedMealId, meals.map((m) => m.id)))
      : Promise.resolve([]),
    getActiveMembers(),
  ]);

  // Most-made dinners, to spot ruts at a glance.
  const counts = new Map<string, { title: string; slug: string; n: number }>();
  for (const m of meals) {
    if (!m.slug || !m.title) continue;
    const c = counts.get(m.slug) ?? { title: m.title, slug: m.slug, n: 0 };
    c.n += 1;
    counts.set(m.slug, c);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 5);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Dinner history" subtitle="The last four months of dinners you actually made." />
      {top.length ? (
        <Card className="mb-4">
          <h2 className="font-bold">Most made</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {top.map((t) => (
              <li key={t.slug}>
                <Link href={`/recipes/${t.slug}`} className="rounded-full bg-surface-muted px-3 py-1 font-semibold">
                  {t.title} ×{t.n}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {meals.length === 0 ? (
        <p className="py-10 text-center text-muted">
          Nothing yet. Tap “We made it” on the Plan or Tonight page after dinner and it shows up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {meals.map((meal) => {
            const mine = ratings.filter((r) => r.plannedMealId === meal.id);
            const avg = mine.length ? mine.reduce((a, r) => a + r.stars, 0) / mine.length : null;
            return (
              <li key={meal.id}>
                <Card className="flex items-center gap-3 p-4">
                  <span className="w-24 shrink-0 text-sm font-bold text-muted">{formatDay(meal.date)}</span>
                  <span className="min-w-0 flex-1">
                    {meal.slug ? (
                      <Link href={`/recipes/${meal.slug}`} className="block truncate font-semibold hover:underline">
                        {meal.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{NIGHT_TYPES[meal.nightType].label}</span>
                    )}
                    {mine.length ? (
                      <span className="text-sm" title={mine.map((r) => `${members.find((m) => m.id === r.memberId)?.name}: ${faceFor(r.stars).label}`).join(", ")}>
                        {mine.map((r) => faceFor(r.stars).emoji).join(" ")}
                      </span>
                    ) : null}
                  </span>
                  {avg !== null ? (
                    <span className="text-2xl" title={faceFor(avg).label}>
                      {faceFor(avg).emoji}
                    </span>
                  ) : meal.slug ? (
                    <Link href={`/rate/${meal.id}`} className="text-sm font-semibold text-tomato">
                      Rate
                    </Link>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
