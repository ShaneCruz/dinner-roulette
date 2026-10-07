import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { cookPhoto, member } from "@/db/schema";
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
