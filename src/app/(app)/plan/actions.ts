"use server";

import { revalidatePath } from "next/cache";
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
