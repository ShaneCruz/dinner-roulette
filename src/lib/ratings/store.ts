import { and, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import type { Database } from "@/db";
import { plannedMeal, rating, recipe } from "@/db/schema";

export type RatingEntry = {
  memberId: string;
  stars: number;
  reasons: string[];
  note: string | null;
};

/** Saves (or updates) each person's rating for a cooked dinner. */
export async function saveRatings(
  db: Database,
  meal: { id: string; recipeId: string },
  entries: RatingEntry[],
  enteredByMemberId: string,
) {
  for (const entry of entries) {
    const values = {
      recipeId: meal.recipeId,
      stars: entry.stars,
      reasons: entry.reasons,
      note: entry.note,
      enteredByMemberId,
    };
    await db
      .insert(rating)
      .values({ plannedMealId: meal.id, memberId: entry.memberId, ...values })
      .onConflictDoUpdate({ target: [rating.plannedMealId, rating.memberId], set: values });
  }
}

export async function ratingsForMeal(db: Database, plannedMealId: string) {
  return db.select().from(rating).where(eq(rating.plannedMealId, plannedMealId));
}

/** Average stars per member per recipe, for the suggestion engine. */
export async function averageRatings(db: Database): Promise<Map<string, Record<string, number>>> {
  const rows = await db
    .select({ memberId: rating.memberId, recipeId: rating.recipeId, stars: rating.stars, createdAt: rating.createdAt })
    .from(rating)
    .orderBy(desc(rating.createdAt));
  // Recent opinions count more than old ones: weight halves every 5 ratings.
  const sums = new Map<string, { total: number; weight: number; n: number }>();
  for (const row of rows) {
    const key = `${row.memberId}|${row.recipeId}`;
    const acc = sums.get(key) ?? { total: 0, weight: 0, n: 0 };
    const w = Math.pow(0.5, acc.n / 5);
    acc.total += row.stars * w;
    acc.weight += w;
    acc.n += 1;
    sums.set(key, acc);
  }
  const result = new Map<string, Record<string, number>>();
  for (const [key, acc] of sums) {
    const [memberId, recipeId] = key.split("|");
    const mine = result.get(memberId) ?? {};
    mine[recipeId] = acc.total / acc.weight;
    result.set(memberId, mine);
  }
  return result;
}

/** Cooked dinners from the last few days that still have people left to rate. */
export async function mealsNeedingRatings(db: Database, from: string, to: string) {
  const meals = await db
    .select({
      id: plannedMeal.id,
      date: plannedMeal.date,
      recipeId: plannedMeal.recipeId,
      eaterIds: plannedMeal.eaterIds,
      title: recipe.title,
      slug: recipe.slug,
    })
    .from(plannedMeal)
    .innerJoin(recipe, eq(recipe.id, plannedMeal.recipeId))
    .where(
      and(
        eq(plannedMeal.status, "cooked"),
        isNotNull(plannedMeal.recipeId),
        gte(plannedMeal.date, from),
        lte(plannedMeal.date, to),
      ),
    )
    .orderBy(desc(plannedMeal.date));
  if (!meals.length) return [];
  const rated = await db
    .select({ plannedMealId: rating.plannedMealId, memberId: rating.memberId })
    .from(rating)
    .where(inArray(rating.plannedMealId, meals.map((m) => m.id)));
  return meals.map((meal) => ({
    ...meal,
    ratedMemberIds: rated.filter((r) => r.plannedMealId === meal.id).map((r) => r.memberId),
  }));
}

/** Ratings for one recipe, newest first, for the recipe page. */
export async function ratingsForRecipe(db: Database, recipeId: string) {
  return db
    .select({
      memberId: rating.memberId,
      stars: rating.stars,
      reasons: rating.reasons,
      note: rating.note,
      date: plannedMeal.date,
    })
    .from(rating)
    .innerJoin(plannedMeal, eq(plannedMeal.id, rating.plannedMealId))
    .where(eq(rating.recipeId, recipeId))
    .orderBy(desc(plannedMeal.date));
}

/** Everything one person has rated, for their profile. */
export async function ratingsByMember(db: Database, memberId: string) {
  return db
    .select({ recipeId: rating.recipeId, stars: rating.stars, reasons: rating.reasons, title: recipe.title, slug: recipe.slug })
    .from(rating)
    .innerJoin(recipe, eq(recipe.id, rating.recipeId))
    .where(eq(rating.memberId, memberId))
    .orderBy(desc(rating.createdAt));
}
