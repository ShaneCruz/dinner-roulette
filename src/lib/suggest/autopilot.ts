import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { weekPlan } from "@/db/schema";
import { getOrCreateWeekPlan, loadMeals, recipeTitles } from "@/lib/plan/store";
import { dayOfWeek, formatDay, weekDates, weekStartFor } from "@/lib/plan/week";
import { addDays } from "@/lib/presence";
import { applySuggestions } from "./apply";

/**
 * Autopilot: on the family's chosen day, plan next week's open nights so
 * nobody has to. Runs once per week; dinners people already picked (and
 * Sunday-session votes) are respected. Returns a short summary to send.
 */
export async function runAutopilot(
  db: Database,
  options: { today: string; nowMinutes: number; weekStartsOn: number; autopilotDay: number; enabled: boolean },
): Promise<{ weekStart: string; filled: number; lines: string[] } | null> {
  if (!options.enabled || dayOfWeek(options.today) !== options.autopilotDay || options.nowMinutes < 9 * 60) return null;
  const weekStart = addDays(weekStartFor(options.today, options.weekStartsOn), 7);
  const plan = await getOrCreateWeekPlan(db, weekStart);
  // Claim the week first so two runs can't both plan it.
  const claimed = await db
    .update(weekPlan)
    .set({ autopilotAt: new Date() })
    .where(and(eq(weekPlan.id, plan.id), isNull(weekPlan.autopilotAt)))
    .returning({ id: weekPlan.id });
  if (!claimed.length) return null;

  const filled = await applySuggestions(db, weekStart, weekStart, options.weekStartsOn);
  const dates = weekDates(weekStart);
  const meals = await loadMeals(db, dates[0], dates[6]);
  const titles = await recipeTitles(db, [...meals.values()].flatMap((m) => (m.recipeId ? [m.recipeId] : [])));
  const lines = dates.map((d) => {
    const meal = meals.get(d);
    const what = !meal
      ? "open"
      : meal.nightType !== "cook"
        ? meal.nightType.replace("_", " ")
        : meal.recipeId
          ? titles.get(meal.recipeId)?.title ?? "dinner"
          : "open";
    return `${formatDay(d)}: ${what}`;
  });
  return { weekStart, filled, lines };
}
