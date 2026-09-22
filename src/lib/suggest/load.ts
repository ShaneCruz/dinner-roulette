import { and, asc, eq, gte, isNotNull, isNull, lt, max } from "drizzle-orm";
import type { Database } from "@/db";
import { familySettings, member, memberFoodRule, plannedMeal, recipe, recipeIngredient, recipeVariant } from "@/db/schema";
import { eatersFor, loadEaterContext, loadMeals } from "@/lib/plan/store";
import { addDays } from "@/lib/presence";
import { averageRatings } from "@/lib/ratings/store";
import { isLockedPick } from "@/lib/fun/card-info";
import { weekVetoes } from "@/lib/fun/cards";
import { votesByMember, weekVotes } from "@/lib/fun/votes";
import { forecast, locateZip } from "@/lib/weather";
import { defaultTimeBudget, weekDates, type TimeBudget } from "@/lib/plan/week";
import type { Chosen, EngineContext, EngineMember, EngineNight, EngineRecipe, TurnHistory, Weather } from "./engine";

/** Everything the engine needs to plan the week starting `weekStart`. */
export async function loadEngineInputs(db: Database, weekStart: string, options: { weather?: boolean } = {}) {
  const dates = weekDates(weekStart);
  const [[settings], recipeRows, ingredientRows, variantRows, lastCookedRows, loves, ratings, eaterContext, meals, turnRows, voteRows, vetoes] =
    await Promise.all([
      db.select().from(familySettings).limit(1),
      db.select().from(recipe).where(and(isNull(recipe.archivedAt), eq(recipe.status, "approved"))),
      db.select({ recipeId: recipeIngredient.recipeId, name: recipeIngredient.name, perishable: recipeIngredient.perishable, optional: recipeIngredient.optional, section: recipeIngredient.section }).from(recipeIngredient),
      db.select({ recipeId: recipeVariant.recipeId, kind: recipeVariant.kind, label: recipeVariant.label, avoids: recipeVariant.avoids }).from(recipeVariant),
      db
        .select({ recipeId: plannedMeal.recipeId, last: max(plannedMeal.date) })
        .from(plannedMeal)
        .where(and(eq(plannedMeal.status, "cooked"), lt(plannedMeal.date, dates[0])))
        .groupBy(plannedMeal.recipeId),
      db
        .select({ memberId: memberFoodRule.memberId, recipeId: memberFoodRule.recipeId })
        .from(memberFoodRule)
        .where(and(eq(memberFoodRule.kind, "love"), isNotNull(memberFoodRule.recipeId))),
      averageRatings(db),
      loadEaterContext(db, dates[0], dates[6]),
      loadMeals(db, dates[0], dates[6]),
      db
        .select({ date: plannedMeal.date, memberId: plannedMeal.favoredMemberId })
        .from(plannedMeal)
        .where(and(isNotNull(plannedMeal.favoredMemberId), gte(plannedMeal.date, addDays(dates[0], -21)), lt(plannedMeal.date, dates[0])))
        .orderBy(asc(plannedMeal.date)),
      weekVotes(db, dates[0]),
      weekVetoes(db, dates[0]),
    ]);
  const votes = votesByMember(voteRows);

  const lastCooked = new Map(lastCookedRows.map((r) => [r.recipeId, r.last]));
  const recipes: EngineRecipe[] = recipeRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    cuisine: r.cuisine,
    tags: r.tags,
    method: r.method,
    activeMinutes: r.activeMinutes,
    totalMinutes: r.totalMinutes,
    spiceLevel: r.spiceLevel,
    spiceSplit: r.spiceSplit,
    seasonFit: r.seasonFit,
    indoorMethod: r.indoorMethod,
    healthCategory: r.healthCategory,
    cooldownDays: r.cooldownDays,
    pairsWith: r.pairsWith,
    ingredients: ingredientRows.filter((i) => i.recipeId === r.id),
    variants: variantRows.filter((v) => v.recipeId === r.id),
    lastCooked: lastCooked.get(r.id) ?? null,
    nutrition: r.nutrition,
  }));

  const memberRoles = new Map(
    (await db.select({ id: member.id, role: member.role }).from(member)).map((m) => [m.id, m.role]),
  );
  const members: EngineMember[] = eaterContext.members.map((m) => ({
    id: m.id,
    name: m.name,
    role: memberRoles.get(m.id) ?? "kid",
    spiceTolerance: m.spiceTolerance,
    nopes: m.nopes,
    lovedRecipeIds: loves.filter((l) => l.memberId === m.id).map((l) => l.recipeId!),
    ratings: ratings.get(m.id) ?? {},
    usuallyAway: m.defaultPresence === "away",
    votes: votes.get(m.id) ?? {},
  }));

  // A usually-away kid's first night home this week earns First Pick.
  const firstNightHome: Record<string, string> = {};
  for (const m of eaterContext.members.filter((x) => x.defaultPresence === "away")) {
    const home = eaterContext.ranges.find(
      (r) => r.memberId === m.id && r.presence === "home" && !r.tentative && dates.includes(r.startDate),
    );
    if (home) firstNightHome[m.id] = home.startDate;
  }

  let weather = new Map<string, Weather>();
  if (options.weather !== false && settings?.homeZip) {
    let { homeLatitude: lat, homeLongitude: lon } = settings;
    if (lat == null || lon == null) {
      const located = await locateZip(settings.homeZip);
      if (located) {
        lat = located.latitude;
        lon = located.longitude;
        await db.update(familySettings).set({ homeLatitude: lat, homeLongitude: lon }).where(eq(familySettings.id, 1));
      }
    }
    if (lat != null && lon != null) weather = await forecast(lat, lon, settings.timezone);
  }

  const context: EngineContext = {
    members,
    recipes,
    settings: {
      defaultCooldownDays: settings?.defaultCooldownDays ?? 14,
      weeknightActiveMinutes: settings?.weeknightActiveMinutes ?? 30,
      healthyNightsTarget: settings?.healthyNightsTarget ?? 5,
      grillCaps: settings?.grillCaps ?? { summer: 3, shoulder: 2, winter: 1 },
    },
    vetoes,
  };

  const nights: (EngineNight & { status: string; nightType: string; recipeId: string | null; suggested: boolean })[] = dates.map((date) => {
    const meal = meals.get(date);
    return {
      date,
      eaterIds: eatersFor(eaterContext, date, meal?.eaterIds).map((m) => m.id),
      budget: (meal?.timeBudget ?? defaultTimeBudget(date)) as TimeBudget,
      weather: weather.get(date) ?? null,
      favoredMemberId: meal?.favoredMemberId ?? null,
      status: meal?.status ?? "empty",
      nightType: meal?.nightType ?? "cook",
      recipeId: meal?.recipeId ?? null,
      suggested: Boolean(meal?.suggestionReason) && !isLockedPick(meal?.suggestionReason),
    };
  });

  const chosen: Chosen[] = nights
    .filter((n) => n.recipeId && n.status !== "skipped" && n.nightType === "cook")
    .map((n) => ({ date: n.date, recipeId: n.recipeId! }));

  const history: TurnHistory = turnRows.map((r) => ({ date: r.date, memberId: r.memberId! }));

  return { context, nights, chosen, history, firstNightHome, weather };
}
