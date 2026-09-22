import { addDays } from "@/lib/presence";

export type TimeBudget = "quick" | "normal" | "weekend" | "hands_off";
export type NightType = "cook" | "leftovers" | "takeout" | "eating_out" | "fend";

export const TIME_BUDGETS: Record<TimeBudget, { label: string; short: string; activeMinutes: number; hint: string }> = {
  quick: { label: "Quick", short: "⚡ Quick", activeMinutes: 20, hint: "20 min hands-on, tops" },
  normal: { label: "Normal", short: "🍳 Normal", activeMinutes: 30, hint: "About 30 min hands-on" },
  weekend: { label: "Weekend", short: "🧑‍🍳 Weekend", activeMinutes: 60, hint: "An hour or more" },
  hands_off: { label: "Hands-off", short: "🍲 Hands-off", activeMinutes: 20, hint: "Set it early, slow cooker style" },
};

export const NIGHT_TYPES: Record<NightType, { label: string; emoji: string }> = {
  cook: { label: "Cook", emoji: "🍳" },
  leftovers: { label: "Leftovers", emoji: "🥡" },
  takeout: { label: "Takeout", emoji: "🛵" },
  eating_out: { label: "Eating out", emoji: "🍽️" },
  fend: { label: "Cereal night", emoji: "🥣" },
};

/** Day of week for a YYYY-MM-DD date, 0 = Sunday. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The first night of the planning week that contains `date`. */
export function weekStartFor(date: string, weekStartsOn: number): string {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isWeekend(date: string): boolean {
  const day = dayOfWeek(date);
  return day === 0 || day === 6;
}

export function defaultTimeBudget(date: string): TimeBudget {
  return isWeekend(date) ? "weekend" : "normal";
}

/**
 * Hands-on minutes allowed for a night. Weeknight "normal" follows the
 * family setting; hands-off nights care about active time only.
 */
export function activeMinutesFor(budget: TimeBudget, weeknightActiveMinutes: number): number {
  if (budget === "normal") return weeknightActiveMinutes;
  return TIME_BUDGETS[budget].activeMinutes;
}

/** Does a recipe fit the night's time budget? */
export function fitsBudget(
  recipe: { activeMinutes: number; totalMinutes: number },
  budget: TimeBudget,
  weeknightActiveMinutes: number,
): boolean {
  if (recipe.activeMinutes > activeMinutesFor(budget, weeknightActiveMinutes)) return false;
  // A long total time is fine on a hands-off or weekend night, but a
  // three-hour braise can't happen on a normal weeknight.
  if (budget === "quick" && recipe.totalMinutes > 40) return false;
  if (budget === "normal" && recipe.totalMinutes > 75) return false;
  return true;
}

export function formatDay(date: string, style: "short" | "long" = "short"): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style === "short" ? "short" : "long",
    month: "short",
    day: "numeric",
  });
}
