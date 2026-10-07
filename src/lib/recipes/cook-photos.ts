import "server-only";
import { and, avg, count, desc, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { cookPhoto, member, plannedMeal, rating, recipe } from "@/db/schema";
import { addDays } from "@/lib/presence";
import { saveRecipePhoto } from "./store";

/** A photo in a recipe's log of makes, without its bytes. */
export type CookPhotoEntry = {
  id: string;
  madeOn: string;
  caption: string | null;
  memberId: string | null;
  who: string | null;
};

export async function addCookPhoto(
  db: Database,
  photo: { recipeId: string; plannedMealId: string | null; memberId: string | null; madeOn: string; contentType: string; data: string },
): Promise<string> {
  const [row] = await db.insert(cookPhoto).values(photo).returning({ id: cookPhoto.id });
  return row.id;
}

/** Every photo of a recipe as it was made, newest first. */
export async function listCookPhotos(db: Database, recipeId: string): Promise<CookPhotoEntry[]> {
  return db
    .select({ id: cookPhoto.id, madeOn: cookPhoto.madeOn, caption: cookPhoto.caption, memberId: cookPhoto.memberId, who: member.name })
    .from(cookPhoto)
    .leftJoin(member, eq(member.id, cookPhoto.memberId))
    .where(eq(cookPhoto.recipeId, recipeId))
    .orderBy(desc(cookPhoto.madeOn), desc(cookPhoto.createdAt));
}

/** The most recent make of each recipe that has one, for "what it looked like last time". */
export async function latestCookPhotos(db: Database, recipeIds: string[]): Promise<Map<string, { id: string; madeOn: string }>> {
  if (!recipeIds.length) return new Map();
  const rows = await db
    .select({ id: cookPhoto.id, recipeId: cookPhoto.recipeId, madeOn: cookPhoto.madeOn })
    .from(cookPhoto)
    .where(inArray(cookPhoto.recipeId, recipeIds))
    .orderBy(desc(cookPhoto.madeOn), desc(cookPhoto.createdAt));
  const latest = new Map<string, { id: string; madeOn: string }>();
  for (const row of rows) if (!latest.has(row.recipeId)) latest.set(row.recipeId, { id: row.id, madeOn: row.madeOn });
  return latest;
}

export async function getCookPhoto(db: Database, id: string) {
  const [row] = await db.select().from(cookPhoto).where(eq(cookPhoto.id, id)).limit(1);
  return row ?? null;
}

export async function deleteCookPhoto(db: Database, id: string) {
  await db.delete(cookPhoto).where(eq(cookPhoto.id, id));
}

/** Makes one of the family's makes the recipe's main picture. The log keeps it too. */
export async function promoteCookPhoto(db: Database, id: string): Promise<string | null> {
  const photo = await getCookPhoto(db, id);
  if (!photo) return null;
  await saveRecipePhoto(db, photo.recipeId, { contentType: photo.contentType, data: photo.data });
  return photo.recipeId;
}

/** Re-dates a photo (taken the morning after, say), linking it to that night's dinner if the dish was on it. */
export async function redateCookPhoto(db: Database, id: string, madeOn: string) {
  const photo = await getCookPhoto(db, id);
  if (!photo) return false;
  const [meal] = await db
    .select({ id: plannedMeal.id, recipeId: plannedMeal.recipeId, sideRecipeIds: plannedMeal.sideRecipeIds })
    .from(plannedMeal)
    .where(eq(plannedMeal.date, madeOn));
  const onThatNight = meal && (meal.recipeId === photo.recipeId || meal.sideRecipeIds.includes(photo.recipeId));
  await db.update(cookPhoto).set({ madeOn, plannedMealId: onThatNight ? meal.id : null }).where(eq(cookPhoto.id, id));
  return true;
}

/** The latest night in the last two weeks the dish was on the plan, so a photo added from the recipe gets that date. */
export async function recentPlannedNight(db: Database, recipeId: string, today: string) {
  const rows = await db
    .select({ id: plannedMeal.id, date: plannedMeal.date, recipeId: plannedMeal.recipeId, sideRecipeIds: plannedMeal.sideRecipeIds })
    .from(plannedMeal)
    .where(and(eq(plannedMeal.nightType, "cook"), ne(plannedMeal.status, "skipped"), gte(plannedMeal.date, addDays(today, -14)), lte(plannedMeal.date, today)))
    .orderBy(desc(plannedMeal.date));
  const found = rows.find((m) => m.recipeId === recipeId || m.sideRecipeIds.includes(recipeId));
  return found ? { id: found.id, date: found.date } : null;
}

/** One photo in Chef Highlights, with what makes it worth showing off. */
export type Highlight = {
  id: string;
  madeOn: string;
  title: string;
  slug: string;
  /** Who took the photo */
  who: string | null;
  /** The family's average stars for that night, if they rated it */
  stars: number | null;
  /** 1 for the first time the family made it, 2 for the second... */
  makeNumber: number;
};

/** Every photo of every dish the family has made, newest first, for Chef Highlights. */
export async function loadHighlights(db: Database): Promise<Highlight[]> {
  const photos = await db
    .select({
      id: cookPhoto.id,
      madeOn: cookPhoto.madeOn,
      recipeId: cookPhoto.recipeId,
      plannedMealId: cookPhoto.plannedMealId,
      title: recipe.title,
      slug: recipe.slug,
      who: member.name,
    })
    .from(cookPhoto)
    .innerJoin(recipe, eq(recipe.id, cookPhoto.recipeId))
    .leftJoin(member, eq(member.id, cookPhoto.memberId))
    .orderBy(desc(cookPhoto.madeOn), desc(cookPhoto.createdAt));
  if (!photos.length) return [];

  const mealIds = [...new Set(photos.flatMap((p) => (p.plannedMealId ? [p.plannedMealId] : [])))];
  const recipeIds = [...new Set(photos.map((p) => p.recipeId))];
  const [ratings, cooked] = await Promise.all([
    mealIds.length
      ? db
          .select({ mealId: rating.plannedMealId, stars: avg(rating.stars) })
          .from(rating)
          .where(inArray(rating.plannedMealId, mealIds))
          .groupBy(rating.plannedMealId)
      : [],
    db
      .select({ recipeId: plannedMeal.recipeId, date: plannedMeal.date })
      .from(plannedMeal)
      .where(and(eq(plannedMeal.status, "cooked"), inArray(plannedMeal.recipeId, recipeIds))),
  ]);
  const starsByMeal = new Map(ratings.map((r) => [r.mealId, r.stars === null ? null : Math.round(Number(r.stars) * 10) / 10]));
  // Every night each dish was made: marked "we made it" on the plan, or photographed.
  const nights = new Map<string, Set<string>>();
  for (const made of [...cooked.map((c) => ({ recipeId: c.recipeId!, date: c.date })), ...photos.map((p) => ({ recipeId: p.recipeId, date: p.madeOn }))]) {
    if (!nights.has(made.recipeId)) nights.set(made.recipeId, new Set());
    nights.get(made.recipeId)!.add(made.date);
  }
  return photos.map((p) => ({
    id: p.id,
    madeOn: p.madeOn,
    title: p.title,
    slug: p.slug,
    who: p.who,
    stars: p.plannedMealId ? starsByMeal.get(p.plannedMealId) ?? null : null,
    makeNumber: [...(nights.get(p.recipeId) ?? [])].filter((date) => date <= p.madeOn).length,
  }));
}

/**
 * The family's cooking, in numbers: dinners made, different dishes, and
 * since when. A dinner counts if it was marked made on the plan or
 * photographed, since people forget to tap "we made it".
 */
export async function cookingStats(db: Database) {
  const [cooked, photos] = await Promise.all([
    db
      .select({ recipeId: plannedMeal.recipeId, date: plannedMeal.date })
      .from(plannedMeal)
      .where(and(eq(plannedMeal.status, "cooked"), eq(plannedMeal.nightType, "cook"), isNotNull(plannedMeal.recipeId))),
    db.select({ recipeId: cookPhoto.recipeId, date: cookPhoto.madeOn }).from(cookPhoto),
  ]);
  const made = [...cooked.map((c) => ({ recipeId: c.recipeId!, date: c.date })), ...photos];
  const dates = made.map((m) => m.date).sort();
  return {
    dinners: new Set(made.map((m) => `${m.date}|${m.recipeId}`)).size,
    dishes: new Set(made.map((m) => m.recipeId)).size,
    since: dates[0] ?? null,
    photos: photos.length,
  };
}

/** The latest few photos and how many there are, for the Chef Highlights card on Tonight. */
export async function recentCookPhotos(db: Database, limit = 4) {
  const [latest, [total]] = await Promise.all([
    db
      .select({ id: cookPhoto.id, title: recipe.title })
      .from(cookPhoto)
      .innerJoin(recipe, eq(recipe.id, cookPhoto.recipeId))
      .orderBy(desc(cookPhoto.madeOn), desc(cookPhoto.createdAt))
      .limit(limit),
    db.select({ n: count() }).from(cookPhoto),
  ]);
  return { latest, total: total?.n ?? 0 };
}
