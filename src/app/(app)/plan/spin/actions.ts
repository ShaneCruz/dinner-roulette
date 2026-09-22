"use server";

import { and, arrayContains, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { recipe, wheelSpin } from "@/db/schema";
import { playCard } from "@/lib/fun/cards";
import { CHAOS, type ChaosKind } from "@/lib/fun/chaos";
import { loadMeals, regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { weekStartFor } from "@/lib/plan/week";
import { addDays, todayIn } from "@/lib/presence";
import { requireActingMember } from "@/lib/session";

const inputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipeId: z.uuid().nullable(),
  chaos: z.enum(["parents_choice", "breakfast", "spinner_side"]).nullable(),
  respin: z.boolean(),
});

/**
 * Saves where the dinner wheel landed. Anyone can spin for an open night
 * or one the planner picked. Once the wheel has decided, spinning again
 * takes a Respin card (parents can always respin).
 */
export async function saveSpinAction(input: z.input<typeof inputSchema>): Promise<{ error: string } | { reason: string }> {
  const { settings, acting } = await requireActingMember();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "That spin didn't count. Try again." };
  const { date, recipeId, chaos, respin } = parsed.data;
  const today = todayIn(settings.timezone);
  if (date < today || date > addDays(today, 14)) return { error: "You can only spin for tonight or the next two weeks." };

  const meal = (await loadMeals(db, date, date)).get(date);
  const isParent = acting.role === "parent";
  if (meal?.status === "cooked") return { error: "That dinner is already made." };
  if (meal && meal.nightType !== "cook") return { error: "That night isn't a cooking night." };
  if (!isParent && meal?.recipeId && (!meal.suggestionReason || meal.suggestionReason.startsWith("👨‍🍳"))) {
    return { error: "Someone already picked that dinner on purpose." };
  }
  const alreadySpun = Boolean(meal?.suggestionReason?.startsWith("🎡") || meal?.suggestionReason?.startsWith("🎲"));
  if (alreadySpun && !isParent) {
    if (!respin) return { error: "The wheel already decided. Play a Respin card to spin again." };
    if (!(await playCard(db, acting.id, "respin", weekStartFor(date, settings.weekStartsOn)))) {
      return { error: "No Respin card to play." };
    }
  }

  let chosen = recipeId;
  let reason = "";
  let notes: string | null = null;
  if (chaos) {
    const info = CHAOS[chaos as ChaosKind];
    if (chaos === "parents_choice") {
      chosen = null;
      reason = `🎲 Chaos! ${info.label}`;
    } else if (chaos === "breakfast") {
      const [breakfast] = await db
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(arrayContains(recipe.tags, ["breakfast"]), eq(recipe.status, "approved"), isNull(recipe.archivedAt)))
        .limit(1);
      chosen = breakfast?.id ?? null;
      reason = `🎲 Chaos! ${info.label} ${info.emoji}`;
      if (!breakfast) notes = "Pancakes, eggs, waffles: your call.";
    } else {
      reason = `🎲 Chaos! ${acting.name} picks the side`;
    }
  } else {
    reason = `🎡 The wheel picked it (spun by ${acting.name})`;
  }

  if (chosen) {
    const [dish] = await db
      .select({ kind: recipe.kind })
      .from(recipe)
      .where(and(eq(recipe.id, chosen), isNull(recipe.archivedAt)));
    if (!dish || dish.kind !== "main") return { error: "That dinner isn't available any more." };
  }

  const planId = await saveNight(db, date, settings.weekStartsOn, {
    nightType: "cook",
    status: "planned",
    recipeId: chosen,
    sideRecipeIds: [],
    suggestionReason: reason,
    ...(notes ? { notes } : {}),
  });
  await db.insert(wheelSpin).values({ date, spunByMemberId: acting.id, recipeId: chosen, chaos });
  await regenerateGroceryList(db, planId);
  revalidatePath("/", "layout");
  return { reason };
}
