import type { Database } from "@/db";
import { getOrCreateWeekPlan, regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { pickCookNights, suggestWeek } from "./engine";
import { loadEngineInputs } from "./load";

/**
 * Fills the week's open cooking nights with suggestions (or re-rolls one
 * night when `onlyDate` is given). Nights already cooked, skipped, or set to
 * takeout/leftovers are left alone, and so are dinners someone picked.
 *
 * With `cookNights`, only enough nights to make that many dinners in the
 * week are filled; the rest stay open for leftovers and the like.
 */
export async function applySuggestions(
  db: Database,
  weekStart: string,
  today: string,
  weekStartsOn: number,
  options: {
    onlyDate?: string;
    random?: () => number;
    weather?: boolean;
    replaceSuggested?: boolean;
    cookNights?: number;
  } = {},
): Promise<number> {
  const { context, nights, chosen, history, firstNightHome } = await loadEngineInputs(db, weekStart, {
    weather: options.weather,
  });

  let fillable = nights.filter(
    (n) =>
      n.date >= today &&
      n.nightType === "cook" &&
      n.status !== "cooked" &&
      n.status !== "skipped" &&
      (options.onlyDate
        ? n.date === options.onlyDate
        : !n.recipeId || (options.replaceSuggested && n.suggested && n.status === "planned")),
  );
  if (options.cookNights !== undefined && !options.onlyDate) {
    const open = new Set(fillable.map((n) => n.date));
    const cooking = nights
      .filter((n) => !open.has(n.date) && n.nightType === "cook" && n.recipeId && n.status !== "skipped")
      .map((n) => n.date);
    fillable = pickCookNights(fillable, cooking, Math.max(0, options.cookNights - cooking.length));
  }
  if (!fillable.length) return 0;

  const avoid: Record<string, string> = {};
  const current = options.onlyDate ? nights.find((n) => n.date === options.onlyDate)?.recipeId : null;
  if (options.onlyDate && current) avoid[options.onlyDate] = current;

  const refilling = new Set(fillable.map((n) => n.date));
  const suggestions = suggestWeek(
    fillable,
    context,
    chosen.filter((c) => !refilling.has(c.date)),
    { random: options.random, history, firstNightHome, avoid },
  );

  for (const s of suggestions) {
    await saveNight(db, s.date, weekStartsOn, {
      nightType: "cook",
      status: "planned",
      recipeId: s.recipeId,
      sideRecipeIds: s.sideRecipeIds,
      favoredMemberId: s.favoredMemberId,
      suggestionReason: s.reason,
    });
  }
  const plan = await getOrCreateWeekPlan(db, weekStart);
  await regenerateGroceryList(db, plan.id);
  return suggestions.length;
}
