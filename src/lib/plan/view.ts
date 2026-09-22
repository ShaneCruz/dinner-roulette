import { db } from "@/db";
import { recipe as recipeTable, restaurant, type Nutrition } from "@/db/schema";
import { eq } from "drizzle-orm";
import { presenceOn } from "@/lib/presence";
import { assignTurns, rankForNight, type Weather } from "@/lib/suggest/engine";
import { loadEngineInputs } from "@/lib/suggest/load";
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
  /** Whose turn it is (saved, or who's up next) */
  favoredMemberId: string | null;
  suggestionReason: string | null;
  weather: Weather | null;
  mealId: string | null;
  restaurantId: string | null;
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
  nutrition: Nutrition | null;
  sourceRating: { rating: number | null; count: number | null } | null;
};

/** How each dinner fits a given night: score order, best reason, or why not. */
export type NightRanking = { recipeId: string; score: number; reason: string | null; excluded: string | null }[];

/** Everything the week board needs, for the week starting `weekStart`. */
export async function loadWeekView(weekStart: string) {
  const dates = weekDates(weekStart);
  const [meals, eaterContext, engine, bumped] = await Promise.all([
    loadMeals(db, dates[0], dates[6]),
    loadEaterContext(db, dates[0], dates[6]),
    loadEngineInputs(db, weekStart),
    listBumped(db),
  ]);

  const turns = assignTurns(
    engine.nights.map((n) => ({ ...n })),
    engine.context.members,
    engine.history,
    engine.firstNightHome,
  );

  const nights: NightView[] = dates.map((date) => {
    const meal = meals.get(date);
    const home = eaterContext.members.filter((m) => presenceOn(m, eaterContext.ranges, date).presence === "home");
    const eating = eatersFor(eaterContext, date, meal?.eaterIds);
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
      favoredMemberId: meal?.favoredMemberId ?? turns.get(date)?.memberId ?? null,
      suggestionReason: meal?.suggestionReason ?? null,
      weather: engine.weather.get(date) ?? null,
      mealId: meal?.id ?? null,
      restaurantId: meal?.restaurantId ?? null,
    };
  });

  // Rank every dinner for every night so the picker can sort and explain.
  const rankings: Record<string, NightRanking> = {};
  for (const night of nights) {
    const engineNight = {
      date: night.date,
      eaterIds: night.eatingIds,
      budget: night.timeBudget,
      weather: night.weather,
      favoredMemberId: night.favoredMemberId,
    };
    rankings[night.date] = rankForNight(engineNight, engine.context, engine.chosen).map((r) => ({
      recipeId: r.recipeId,
      score: Number.isFinite(r.score) ? r.score : -99,
      reason: r.reasons[0] ?? null,
      excluded: r.excluded,
    }));
  }

  const options: RecipeOption[] = engine.context.recipes.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    activeMinutes: r.activeMinutes,
    totalMinutes: r.totalMinutes,
    spiceLevel: r.spiceLevel,
    healthCategory: r.healthCategory,
    seasonFit: r.seasonFit,
    lastCooked: r.lastCooked,
    nutrition: r.nutrition ?? null,
    sourceRating: r.sourceRating ?? null,
  }));
  // Drafts and archived recipes aren't suggested, but a night might still use one.
  for (const night of nights) {
    for (const id of [night.recipeId, ...night.sideRecipeIds]) {
      if (id && !options.some((o) => o.id === id)) {
        const [missing] = await db.select().from(recipeTable).where(eq(recipeTable.id, id)).limit(1);
        if (missing) {
          options.push({
            id: missing.id,
            slug: missing.slug,
            title: missing.title,
            kind: missing.kind,
            activeMinutes: missing.activeMinutes,
            totalMinutes: missing.totalMinutes,
            spiceLevel: missing.spiceLevel,
            healthCategory: missing.healthCategory,
            seasonFit: missing.seasonFit,
            lastCooked: null,
            nutrition: missing.nutrition,
            sourceRating: missing.sourceRating !== null ? { rating: missing.sourceRating, count: missing.sourceRatingCount } : null,
          });
        }
      }
    }
  }
  options.sort((a, b) => a.title.localeCompare(b.title));

  const restaurants = await db.select({ id: restaurant.id, name: restaurant.name }).from(restaurant);

  return { dates, nights, options, bumped, rankings, restaurants };
}
