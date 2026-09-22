"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { requireParentMember } from "@/lib/session";

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
