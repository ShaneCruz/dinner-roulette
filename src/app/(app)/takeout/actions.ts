"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { cleanFavorites, EMPTY_FAVORITES } from "@/lib/restaurants/favorites";
import { getActiveMembers, requireActingMember, requireParentMember } from "@/lib/session";
import { friendlyAiError } from "@/lib/ai/claude";
import { askAboutMenu } from "@/lib/ai/menu-chat";
import type { ChatTurn } from "@/lib/ai/kitchen";
import { getRestaurant, loadDiners } from "@/lib/restaurants/store";
import { SPICE_LABELS } from "@/lib/family";

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

/**
 * Questions about a restaurant's menu: "I always get the gyros, but I want
 * something lighter — what else is good?" It answers from the menu we hold,
 * so it only helps once that menu is real.
 */
export async function askMenuQuestion(
  restaurantId: string,
  history: ChatTurn[],
): Promise<{ error: string } | { answer: string }> {
  await requireActingMember();
  if (!z.uuid().safeParse(restaurantId).success) return { error: "Unknown restaurant." };
  const turns = history
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-8)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "Ask a question first." };

  const place = await getRestaurant(db, restaurantId);
  if (!place) return { error: "That restaurant is gone." };
  const dishes = place.research?.dishes ?? [];
  if (!dishes.length) return { error: "We don't have this menu yet. Paste or photograph it first." };

  try {
    const members = await getActiveMembers();
    const diners = await loadDiners(db);
    const favorites = place.favorites ?? null;
    const answer = await askAboutMenu(
      {
        restaurantName: place.name,
        dishes,
        diners: members.map((m) => {
          const diner = diners.find((d) => d.memberId === m.id);
          return {
            name: m.name,
            spice: SPICE_LABELS[m.spiceTolerance] ?? "mild",
            nopes: diner?.nopes ?? [],
            usual: favorites?.people[m.id]?.dishes[0] ?? null,
          };
        }),
      },
      turns,
    );
    return { answer };
  } catch (error) {
    console.error("Menu question failed", error);
    return { error: friendlyAiError(error) };
  }
}
