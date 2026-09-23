"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { cleanFavorites, EMPTY_FAVORITES } from "@/lib/restaurants/favorites";
import { requireActingMember, requireParentMember } from "@/lib/session";

const restaurantSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  cuisine: z.string().trim().min(1, "What kind of food?").max(60),
  area: z.string().trim().max(80).transform((v) => v || null),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v || null)),
  phone: z.string().trim().max(40).transform((v) => v || null),
  notes: z.string().trim().max(500).transform((v) => v || null),
});

export async function saveRestaurant(
  id: string | null,
  input: z.input<typeof restaurantSchema>,
): Promise<{ error: string } | { id: string }> {
  await requireParentMember();
  const parsed = restaurantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  let savedId = id;
  if (id) {
    await db.update(restaurant).set(parsed.data).where(eq(restaurant.id, id));
  } else {
    const [created] = await db.insert(restaurant).values(parsed.data).returning({ id: restaurant.id });
    savedId = created.id;
  }
  revalidatePath("/takeout", "layout");
  return { id: savedId! };
}

export async function archiveRestaurant(id: string) {
  await requireParentMember();
  await db.update(restaurant).set({ archivedAt: new Date() }).where(eq(restaurant.id, id));
  revalidatePath("/takeout", "layout");
}

/** Makes a night a takeout night from this restaurant. */
export async function orderFrom(restaurantId: string, date: string): Promise<{ error: string } | void> {
  const { settings } = await requireParentMember();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Unknown night." };
  const planId = await saveNight(db, date, settings.weekStartsOn, {
    nightType: "takeout",
    status: "planned",
    recipeId: null,
    sideRecipeIds: [],
    suggestionReason: null,
    restaurantId,
  });
  await regenerateGroceryList(db, planId);
  revalidatePath("/", "layout");
}

const favoritesSchema = z.object({
  people: z.record(
    z.uuid(),
    z.object({ dishes: z.array(z.string().max(120)).max(20), feeling: z.enum(["love", "fine", "meh"]).nullable() }),
  ),
  // A bare name is how these were saved before quantities; still accepted.
  shared: z
    .array(
      z.union([
        z.string().max(120),
        z.object({ dish: z.string().max(120), qty: z.union([z.number().int().min(1).max(20), z.literal("each")]) }),
      ]),
    )
    .max(30),
});

/**
 * Saves the usual order. Parents can edit everything; kids can only change
 * their own favorites and how they feel about the place.
 */
export async function saveFavorites(
  restaurantId: string,
  input: z.input<typeof favoritesSchema>,
): Promise<{ error: string } | { ok: true }> {
  const { acting } = await requireActingMember();
  const parsed = favoritesSchema.safeParse(input);
  if (!z.uuid().safeParse(restaurantId).success || !parsed.success) return { error: "Couldn't save those favorites." };
  const [place] = await db.select({ favorites: restaurant.favorites }).from(restaurant).where(eq(restaurant.id, restaurantId));
  if (!place) return { error: "That restaurant is gone." };

  let next = parsed.data;
  if (acting.role !== "parent") {
    const current = place.favorites ?? EMPTY_FAVORITES;
    const mine = parsed.data.people[acting.id];
    const people = { ...current.people };
    if (mine) people[acting.id] = mine;
    else delete people[acting.id];
    next = { people, shared: current.shared };
  }
  await db.update(restaurant).set({ favorites: cleanFavorites(next) }).where(eq(restaurant.id, restaurantId));
  revalidatePath("/takeout", "layout");
  return { ok: true };
}
