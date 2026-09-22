import type { Database } from "@/db";
import { getOrCreateWeekPlan, regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { suggestWeek } from "./engine";
import { loadEngineInputs } from "./load";

/**
 * Fills the week's open cooking nights with suggestions (or re-rolls one
 * night when `onlyDate` is given). Nights already cooked, skipped, or set to
 * takeout/leftovers are left alone, and so are dinners someone picked.
 */
export async function applySuggestions(
  db: Database,
  weekStart: string,
  today: string,
  weekStartsOn: number,
  options: { onlyDate?: string; random?: () => number; weather?: boolean } = {},
): Promise<number> {
  const { context, nights, chosen, history, firstNightHome } = await loadEngineInputs(db, weekStart, {
    weather: options.weather,
  });

  const fillable = nights.filter(
    (n) =>
      n.date >= today &&
      n.nightType === "cook" &&
      n.status !== "cooked" &&
      n.status !== "skipped" &&
      (options.onlyDate ? n.date === options.onlyDate : !n.recipeId),
  );
  if (!fillable.length) return 0;

  const avoid: Record<string, string> = {};
  const current = options.onlyDate ? nights.find((n) => n.date === options.onlyDate)?.recipeId : null;
  if (options.onlyDate && current) avoid[options.onlyDate] = current;

  const suggestions = suggestWeek(
    fillable,
    context,
    chosen.filter((c) => c.date !== options.onlyDate),
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
