import { and, eq, lt, max } from "drizzle-orm";
import { db } from "@/db";
import { plannedMeal } from "@/db/schema";
import { presenceOn } from "@/lib/presence";
import { listRecipes } from "@/lib/recipes/store";
import { eatersFor, listBumped, loadEaterContext, loadMeals, servingsFor } from "./store";
import { defaultTimeBudget, weekDates, type NightType, type TimeBudget } from "./week";

export type NightView = {
  date: string;
  nightType: NightType;
  recipeId: string | null;
  sideRecipeIds: string[];
  status: "planned" | "cooked" | "skipped" | "empty";
  timeBudget: TimeBudget;
  /** Explicit eater list, or null when it follows who's home */
  eaterIds: string[] | null;
  /** Who is actually eating (explicit or from home/away dates) */
  eatingIds: string[];
  /** Who is home per the calendar, for the "reset to auto" hint */
  homeIds: string[];
  servings: number;
  servingsOverridden: boolean;
  notes: string | null;
};

export type RecipeOption = {
  id: string;
  slug: string;
  title: string;
  kind: "main" | "side";
  activeMinutes: number;
  totalMinutes: number;
  spiceLevel: number;
  healthCategory: "healthy" | "balanced" | "comfort";
  seasonFit: "any" | "warm" | "cold";
  lastCooked: string | null;
};

/** Everything the week board needs, for the week starting `weekStart`. */
export async function loadWeekView(weekStart: string) {
  const dates = weekDates(weekStart);
  const [meals, context, recipes, lastCookedRows, bumped] = await Promise.all([
    loadMeals(db, dates[0], dates[6]),
    loadEaterContext(db, dates[0], dates[6]),
    listRecipes(db),
    db
      .select({ recipeId: plannedMeal.recipeId, last: max(plannedMeal.date) })
      .from(plannedMeal)
      .where(and(eq(plannedMeal.status, "cooked"), lt(plannedMeal.date, dates[0])))
      .groupBy(plannedMeal.recipeId),
    listBumped(db),
  ]);

  const lastCooked = new Map(lastCookedRows.map((r) => [r.recipeId, r.last]));

  const nights: NightView[] = dates.map((date) => {
    const meal = meals.get(date);
    const home = context.members.filter((m) => presenceOn(m, context.ranges, date).presence === "home");
    const eating = eatersFor(context, date, meal?.eaterIds);
    return {
      date,
      nightType: meal?.nightType ?? "cook",
      recipeId: meal?.recipeId ?? null,
      sideRecipeIds: meal?.sideRecipeIds ?? [],
      status: meal ? meal.status : "empty",
      timeBudget: meal?.timeBudget ?? defaultTimeBudget(date),
      eaterIds: meal?.eaterIds ?? null,
      eatingIds: eating.map((m) => m.id),
      homeIds: home.map((m) => m.id),
      servings: servingsFor({ servings: meal?.servings ?? null }, eating.length),
      servingsOverridden: meal?.servings != null,
      notes: meal?.notes ?? null,
    };
  });

  const options: RecipeOption[] = recipes.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    activeMinutes: r.activeMinutes,
    totalMinutes: r.totalMinutes,
    spiceLevel: r.spiceLevel,
    healthCategory: r.healthCategory,
    seasonFit: r.seasonFit,
    lastCooked: lastCooked.get(r.id) ?? null,
  }));

  return { dates, nights, options, bumped };
}
