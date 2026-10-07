import "server-only";
import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { cookPhoto, member, plannedMeal } from "@/db/schema";
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
