"use server";

import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  clearNight,
  discardBumped,
  placeBumped,
  regenerateGroceryList,
  saveNight,
  skipNight,
  swapNights,
  type NightPatch,
} from "@/lib/plan/store";
import { weekStartFor } from "@/lib/plan/week";
import { requireParentMember } from "@/lib/session";
import { getOrCreateWeekPlan } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { applySuggestions } from "@/lib/suggest/apply";
import { recipe as recipeTable } from "@/db/schema";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { recommendSides, writeSideRecipe } from "@/lib/ai/sides";
import { ensureNutrition } from "@/lib/nutrition-store";
import { loadMeals } from "@/lib/plan/store";
import { getRecipe, saveRecipe, slugify, uniqueSlug } from "@/lib/recipes/store";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z
  .object({
    nightType: z.enum(["cook", "leftovers", "takeout", "eating_out", "fend"]),
    recipeId: z.uuid().nullable(),
    sideRecipeIds: z.array(z.uuid()).max(4),
    eaterIds: z.array(z.uuid()).nullable(),
    servings: z.number().int().min(1).max(40).nullable(),
    timeBudget: z.enum(["quick", "normal", "weekend", "hands_off"]),
    status: z.enum(["planned", "cooked", "skipped"]),
    notes: z.string().trim().max(300).nullable(),
  })
  .partial();

function refresh() {
  revalidatePath("/", "layout");
}

async function afterChange(weekPlanIds: string[]) {
  for (const id of new Set(weekPlanIds)) await regenerateGroceryList(db, id);
  refresh();
}

export async function updateNight(date: string, patch: NightPatch): Promise<{ error: string } | void> {
  const { settings } = await requireParentMember();
  const parsedDate = dateSchema.safeParse(date);
  const parsed = patchSchema.safeParse(patch);
  if (!parsedDate.success || !parsed.success) return { error: "That change didn't make sense. Try again." };
  // Picking a dinner also means "we're cooking" and resets a skipped night.
  const values: NightPatch = { ...parsed.data };
  if (values.recipeId) {
    values.nightType = "cook";
    values.status ??= "planned";
    // A dinner someone picked by hand isn't a suggestion any more.
    values.suggestionReason = null;
  }
  if (values.nightType && values.nightType !== "cook") {
    values.recipeId = null;
    values.sideRecipeIds = [];
  }
  if (values.nightType && values.nightType !== "takeout") values.restaurantId = null;
  const planId = await saveNight(db, date, settings.weekStartsOn, values);
  await afterChange([planId]);
}

export async function clearNightAction(date: string) {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(date).success) return;
  await clearNight(db, date);
  const plan = await getOrCreateWeekPlan(db, weekStartFor(date, settings.weekStartsOn));
  await afterChange([plan.id]);
}

export async function skipNightAction(date: string, keepForLater: boolean) {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(date).success) return;
  await skipNight(db, date, settings.weekStartsOn, keepForLater);
  const plan = await getOrCreateWeekPlan(db, weekStartFor(date, settings.weekStartsOn));
  await afterChange([plan.id]);
}

export async function swapNightsAction(a: string, b: string) {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(a).success || !dateSchema.safeParse(b).success || a === b) return;
  await swapNights(db, a, b, settings.weekStartsOn);
  const plans = await Promise.all(
    [a, b].map((d) => getOrCreateWeekPlan(db, weekStartFor(d, settings.weekStartsOn))),
  );
  await afterChange(plans.map((p) => p.id));
}

export async function placeBumpedAction(bumpedId: string, date: string) {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(date).success) return;
  const planId = await placeBumped(db, bumpedId, date, settings.weekStartsOn);
  if (planId) await afterChange([planId]);
}

export async function discardBumpedAction(bumpedId: string) {
  await requireParentMember();
  await discardBumped(db, bumpedId);
  refresh();
}

/** Fills the week's open cooking nights with suggestions. */
export async function suggestWeekAction(weekStart: string): Promise<{ error: string } | { filled: number }> {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(weekStart).success) return { error: "Unknown week." };
  const filled = await applySuggestions(db, weekStart, todayIn(settings.timezone), settings.weekStartsOn);
  refresh();
  return { filled };
}

/** Swaps one night's dinner for the next-best idea. */
export async function anotherIdeaAction(date: string): Promise<{ error: string } | void> {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(date).success) return { error: "Unknown night." };
  const weekStart = weekStartFor(date, settings.weekStartsOn);
  const filled = await applySuggestions(db, weekStart, todayIn(settings.timezone), settings.weekStartsOn, {
    onlyDate: date,
  });
  if (!filled) return { error: "Out of ideas for that night. Try loosening the time or who's eating." };
  refresh();
}

export type SideIdea = {
  existingId: string | null;
  existingSlug: string | null;
  title: string;
  why: string;
  handsOnMinutes: number;
  healthy: boolean;
};

async function tonightsMain(date: string) {
  const meal = (await loadMeals(db, date, date)).get(date);
  if (!meal?.recipeId || meal.nightType !== "cook") return null;
  const main = await getRecipe(db, { id: meal.recipeId });
  return main ? { meal, main } : null;
}

async function suggestSides(
  main: NonNullable<Awaited<ReturnType<typeof getRecipe>>>,
  chosenIds: string[],
): Promise<{ error: string } | { ideas: SideIdea[] }> {
  const sides = await db
    .select({ id: recipeTable.id, slug: recipeTable.slug, title: recipeTable.title, activeMinutes: recipeTable.activeMinutes, healthCategory: recipeTable.healthCategory })
    .from(recipeTable)
    .where(and(eq(recipeTable.kind, "side"), isNull(recipeTable.archivedAt)));
  const chosen = sides.filter((s) => chosenIds.includes(s.id));

  if (!aiEnabled()) {
    // Without AI: the sides this dinner pairs with, then the rest.
    const ranked = [...sides].sort((a, b) => Number(main.pairsWith.includes(b.slug)) - Number(main.pairsWith.includes(a.slug)));
    return {
      ideas: ranked
        .filter((s) => !chosen.some((c) => c.id === s.id))
        .slice(0, 4)
        .map((s) => ({ existingId: s.id, existingSlug: s.slug, title: s.title, why: main.pairsWith.includes(s.slug) ? "A usual pairing" : "From your sides", handsOnMinutes: s.activeMinutes, healthy: s.healthCategory === "healthy" })),
    };
  }
  try {
    const brief = await loadFamilyBrief(db);
    const ideas = await recommendSides(main, brief, chosen.map((c) => c.title));
    return {
      ideas: ideas.map((idea) => {
        const existing = idea.existingSlug ? sides.find((s) => s.slug === idea.existingSlug) : undefined;
        return { ...idea, existingId: existing?.id ?? null, existingSlug: existing?.slug ?? null, title: existing?.title ?? idea.title };
      }),
    };
  } catch (error) {
    console.error("Side suggestions failed", error);
    return { error: friendlyAiError(error) };
  }
}

/** Suggests sides for a night's dinner: the family's own, plus easy new ideas. */
export async function recommendSidesAction(date: string): Promise<{ error: string } | { ideas: SideIdea[] }> {
  await requireParentMember();
  if (!dateSchema.safeParse(date).success) return { error: "Unknown night." };
  const found = await tonightsMain(date);
  if (!found) return { error: "Pick a dinner for that night first." };
  return suggestSides(found.main, found.meal.sideRecipeIds);
}

/** Same, for a dinner being picked (not saved to the night yet). */
export async function recommendSidesForMainAction(recipeId: string, chosenIds: string[]): Promise<{ error: string } | { ideas: SideIdea[] }> {
  await requireParentMember();
  if (!z.uuid().safeParse(recipeId).success) return { error: "Unknown dinner." };
  const main = await getRecipe(db, { id: recipeId });
  if (!main) return { error: "Unknown dinner." };
  return suggestSides(main, chosenIds.filter((id) => z.uuid().safeParse(id).success));
}

/**
 * Adds a side to a night. A new idea gets a full recipe written and saved to
 * the family's sides first. Either way the main remembers the pairing, so the
 * planner offers it next time.
 */
export async function addSideAction(
  date: string,
  idea: { existingId: string | null; title: string },
): Promise<{ error: string } | { title: string; slug: string; created: boolean }> {
  const { settings, acting } = await requireParentMember();
  if (!dateSchema.safeParse(date).success) return { error: "Unknown night." };
  const found = await tonightsMain(date);
  if (!found) return { error: "Pick a dinner for that night first." };

  let side: { id: string; slug: string; title: string } | null = null;
  let created = false;
  if (idea.existingId && z.uuid().safeParse(idea.existingId).success) {
    const [row] = await db
      .select({ id: recipeTable.id, slug: recipeTable.slug, title: recipeTable.title, kind: recipeTable.kind })
      .from(recipeTable)
      .where(eq(recipeTable.id, idea.existingId));
    if (row?.kind === "side") side = row;
  } else {
    const title = idea.title.trim().slice(0, 80);
    if (!title) return { error: "Which side?" };
    // Already have one by that name? Use it instead of writing a duplicate.
    const [same] = await db
      .select({ id: recipeTable.id, slug: recipeTable.slug, title: recipeTable.title })
      .from(recipeTable)
      .where(and(eq(recipeTable.kind, "side"), isNull(recipeTable.archivedAt), ilike(recipeTable.title, title)));
    if (same) side = same;
    else {
      try {
        const recipe = await writeSideRecipe(title, found.main.title, await loadFamilyBrief(db));
        if (!recipe) return { error: "Couldn't write that side. Try another one." };
        const slug = await uniqueSlug(db, slugify(recipe.title));
        const id = await saveRecipe(db, { ...recipe, slug }, {
          source: "ai",
          status: "approved",
          notes: `Added as a side for ${found.main.title}.`,
          createdByMemberId: acting.id,
        });
        side = { id, slug, title: recipe.title };
        created = true;
        after(async () => {
          try {
            await ensureNutrition(db, id);
          } catch (error) {
            console.error("Nutrition estimate failed", error);
          }
        });
      } catch (error) {
        console.error("Writing a side failed", error);
        return { error: friendlyAiError(error) };
      }
    }
  }
  if (!side) return { error: "That side isn't available." };

  const sideIds = [...new Set([...found.meal.sideRecipeIds, side.id])].slice(-4);
  const planId = await saveNight(db, date, settings.weekStartsOn, { sideRecipeIds: sideIds });
  if (!found.main.pairsWith.includes(side.slug)) {
    await db
      .update(recipeTable)
      .set({ pairsWith: [...found.main.pairsWith, side.slug], updatedAt: sql`${recipeTable.updatedAt}` as unknown as Date })
      .where(eq(recipeTable.id, found.main.id));
  }
  await afterChange([planId]);
  return { title: side.title, slug: side.slug, created };
}

export async function removeSideAction(date: string, sideId: string) {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(date).success || !z.uuid().safeParse(sideId).success) return;
  const meal = (await loadMeals(db, date, date)).get(date);
  if (!meal) return;
  const planId = await saveNight(db, date, settings.weekStartsOn, { sideRecipeIds: meal.sideRecipeIds.filter((id) => id !== sideId) });
  await afterChange([planId]);
}
