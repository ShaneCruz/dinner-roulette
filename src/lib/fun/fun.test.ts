import { beforeAll, describe, expect, it } from "vitest";
import { STARTER_RECIPES } from "@/data/starter-recipes";
import type { Database } from "@/db";
import { familySettings, member, rating, wheelSpin } from "@/db/schema";
import { loadMeals, saveNight } from "@/lib/plan/store";
import { recipeInputSchema } from "@/lib/recipes/schema";
import { seedStarterRecipes } from "@/lib/recipes/seed";
import { getRecipe } from "@/lib/recipes/store";
import { applySuggestions } from "@/lib/suggest/apply";
import { rankForNight, scoreRecipe, seededRandom, type EngineContext, type EngineMember, type EngineRecipe } from "@/lib/suggest/engine";
import { createTestDatabase } from "@/test/db";
import { computeBadges, EMPTY_STATS, loadBadgeStats, ratingStreak } from "./badges";
import { isLockedPick } from "./card-info";
import { grantCard, loadHands, playCard, undoVeto, weekVetoes } from "./cards";
import { CHAOS_CHANCE, pickWheelIndex } from "./chaos";
import { buildDeck, seedFrom, tallyVotes } from "./deck";
import { loadSession } from "./session";
import { castVote, weekVotes } from "./votes";

function toEngine(slug: string): EngineRecipe {
  const r = recipeInputSchema.parse(STARTER_RECIPES.find((x) => x.slug === slug)!);
  return {
    id: r.slug, slug: r.slug, title: r.title, kind: r.kind, cuisine: r.cuisine, tags: r.tags, method: r.method,
    activeMinutes: r.activeMinutes, totalMinutes: r.totalMinutes, spiceLevel: r.spiceLevel, spiceSplit: r.spiceSplit,
    seasonFit: r.seasonFit, indoorMethod: r.indoorMethod, healthCategory: r.healthCategory, cooldownDays: r.cooldownDays,
    pairsWith: r.pairsWith, ingredients: r.ingredients, variants: r.variants, lastCooked: null,
  };
}

const kidMember = (id: string, extra: Partial<EngineMember> = {}): EngineMember => ({
  id, name: id, role: "kid", spiceTolerance: 1, nopes: [], lovedRecipeIds: [], ratings: {}, ...extra,
});

const recipes = STARTER_RECIPES.map((r) => toEngine(r.slug));
const settings = { defaultCooldownDays: 14, weeknightActiveMinutes: 30, healthyNightsTarget: 5, grillCaps: { summer: 3, shoulder: 2, winter: 1 } };
const night = { date: "2026-10-13", eaterIds: ["a", "b"], budget: "weekend" as const };

describe("votes and vetoes in the engine", () => {
  it("a love vote moves a dinner up, a nope moves it down", () => {
    const base: EngineContext = { members: [kidMember("a"), kidMember("b")], recipes, settings };
    const neutral = rankForNight(night, base, []).filter((r) => !r.excluded);
    const target = neutral[neutral.length - 1].recipeId;
    const loved: EngineContext = {
      ...base,
      members: [kidMember("a", { votes: { [target]: 2 } }), kidMember("b", { votes: { [target]: 4 } })],
    };
    const lovedRank = rankForNight(night, loved, []).findIndex((r) => r.recipeId === target);
    expect(lovedRank).toBeLessThan(neutral.length - 1);
    const scored = scoreRecipe(recipes.find((r) => r.id === target)!, night, loved, []);
    expect(scored.reasons.join(" ")).toMatch(/doubled down|loved it/);

    const top = neutral[0].recipeId;
    const noped: EngineContext = { ...base, members: [kidMember("a", { votes: { [top]: -1 } }), kidMember("b", { votes: { [top]: -1 } })] };
    expect(rankForNight(night, noped, [])[0].recipeId).not.toBe(top);
  });

  it("a veto takes a dinner off the table", () => {
    const context: EngineContext = {
      members: [kidMember("a"), kidMember("b")],
      recipes,
      settings,
      vetoes: [{ recipeId: "taco-night", memberId: "b" }],
    };
    const scored = scoreRecipe(recipes.find((r) => r.id === "taco-night")!, night, context, []);
    expect(scored.excluded).toBe("Vetoed by b this week");
  });
});

describe("the swipe deck", () => {
  const context: EngineContext = { members: [kidMember("a"), kidMember("b")], recipes, settings };
  const nights = [night, { ...night, date: "2026-10-14" }];

  it("deals the same 12 usable mains in the same order for the whole week", () => {
    const deck = buildDeck(nights, context, [], { seed: seedFrom("2026-10-11") });
    expect(deck).toHaveLength(12);
    expect(new Set(deck).size).toBe(12);
    expect(deck.every((id) => recipes.find((r) => r.id === id)?.kind === "main")).toBe(true);
    expect(buildDeck(nights, context, [], { seed: seedFrom("2026-10-11") })).toEqual(deck);
  });

  it("isn't reshuffled by votes or vetoes", () => {
    const deck = buildDeck(nights, context, [], { seed: 3 });
    const voted = { ...context, vetoes: [{ recipeId: deck[0], memberId: "a" }], members: [kidMember("a", { votes: { [deck[1]]: -1 } }), kidMember("b")] };
    expect(buildDeck(nights, voted, [], { seed: 3 })).toEqual(deck);
  });

  it("always includes something never made", () => {
    const cooked = recipes.map((r, i) => (i % 3 === 0 ? r : { ...r, lastCooked: "2026-01-01" }));
    const deck = buildDeck(nights, { ...context, recipes: cooked }, [], { seed: 1 });
    expect(deck.filter((id) => !cooked.find((r) => r.id === id)!.lastCooked).length).toBeGreaterThanOrEqual(2);
  });

  it("tallies votes with vetoed dinners at the bottom", () => {
    const tally = tallyVotes(
      ["x", "y", "z"],
      [
        { memberId: "a", recipeId: "x", vote: 1 },
        { memberId: "b", recipeId: "y", vote: 2 },
        { memberId: "a", recipeId: "y", vote: 4 },
        { memberId: "a", recipeId: "z", vote: 4 },
      ],
      [{ memberId: "b", recipeId: "z" }],
    );
    expect(tally.map((t) => t.recipeId)).toEqual(["y", "x", "z"]);
    expect(tally[0]).toMatchObject({ loves: 2, yeses: 0, nopes: 0 });
    expect(tally[2].vetoedBy).toEqual(["b"]);
  });
});

describe("the chaos slice", () => {
  it("comes up about 1 in 20 spins and never otherwise favors a slice", () => {
    const random = seededRandom(42);
    const counts = new Array(7).fill(0);
    for (let i = 0; i < 20000; i++) counts[pickWheelIndex(7, 6, random)]++;
    expect(counts[6] / 20000).toBeGreaterThan(CHAOS_CHANCE * 0.8);
    expect(counts[6] / 20000).toBeLessThan(CHAOS_CHANCE * 1.2);
    for (let i = 0; i < 6; i++) expect(counts[i] / 20000).toBeGreaterThan(0.14);
  });

  it("spins evenly with no chaos slice", () => {
    const random = seededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(pickWheelIndex(4, null, random));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("marks wheel and Chef's Pick dinners as locked", () => {
    expect(isLockedPick("🎡 The wheel picked it (spun by Kid)")).toBe(true);
    expect(isLockedPick("👨‍🍳 Kid's Chef's Pick")).toBe(true);
    expect(isLockedPick("🎲 Chaos! Parents' Choice")).toBe(true);
    expect(isLockedPick("Healthy night")).toBe(false);
    expect(isLockedPick(null)).toBe(false);
  });
});

describe("badges", () => {
  it("earns badges from stats and shows progress on the rest", () => {
    const badges = computeBadges({ ...EMPTY_STATS, ratings: 4, vetoes: 1 });
    expect(badges.find((b) => b.id === "first-bite")?.earned).toBe(true);
    expect(badges.find((b) => b.id === "veto")?.earned).toBe(true);
    const critic = badges.find((b) => b.id === "critic")!;
    expect(critic.earned).toBe(false);
    expect(critic.progress).toBeCloseTo(0.4);
    expect(critic.label).toBe("4/10");
  });

  it("counts rating streaks in weeks, forgiving a quiet start to this week", () => {
    // Weeks start Sunday. Ratings in the three weeks before this one.
    expect(ratingStreak(["2026-10-01", "2026-10-06", "2026-10-15"], "2026-10-19", 0)).toBe(3);
    expect(ratingStreak(["2026-10-01", "2026-10-15"], "2026-10-19", 0)).toBe(1);
    expect(ratingStreak(["2026-09-01"], "2026-10-19", 0)).toBe(0);
  });
});

describe("cards, votes and the session (database)", () => {
  let db: Database;
  let ids: Record<string, string> = {};
  const WEEK = "2026-10-11";

  beforeAll(async () => {
    db = await createTestDatabase();
    await db.insert(familySettings).values({ id: 1, familyName: "Test", setupCompletedAt: new Date() });
    await seedStarterRecipes(db);
    const rows = await db
      .insert(member)
      .values([
        { name: "Mom", role: "parent" },
        { name: "Kid", role: "kid" },
        { name: "Tween", role: "kid", spiceTolerance: 0 },
      ])
      .returning();
    ids = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  });

  it("gives each kid one veto a week and none to parents", async () => {
    const tacos = (await getRecipe(db, { slug: "taco-night" }))!;
    expect(await playCard(db, ids.Mom, "veto", WEEK, tacos.id)).toBe(false);
    expect(await playCard(db, ids.Kid, "veto", WEEK, tacos.id)).toBe(true);
    expect(await playCard(db, ids.Kid, "veto", WEEK, tacos.id)).toBe(false);
    expect(await playCard(db, ids.Kid, "veto", "2026-10-18", tacos.id)).toBe(true);
    expect((await loadHands(db, WEEK)).get(ids.Kid)?.vetoesLeft).toBe(0);
    expect((await loadHands(db, WEEK)).get(ids.Tween)?.vetoesLeft).toBe(1);
    expect(await weekVetoes(db, WEEK)).toEqual([{ memberId: ids.Kid, recipeId: tacos.id }]);
  });

  it("spends a granted power-up exactly once", async () => {
    expect(await playCard(db, ids.Tween, "respin", WEEK)).toBe(false);
    await grantCard(db, ids.Tween, "respin", { reason: "Unloaded the dishwasher", grantedBy: ids.Mom });
    expect((await loadHands(db, WEEK)).get(ids.Tween)?.powerUps.respin).toBe(1);
    const [a, b] = await Promise.all([playCard(db, ids.Tween, "respin", WEEK), playCard(db, ids.Tween, "respin", WEEK)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((await loadHands(db, WEEK)).get(ids.Tween)?.powerUps.respin).toBe(0);
  });

  it("keeps vetoed dinners and votes in the plan the session builds", async () => {
    const tacos = (await getRecipe(db, { slug: "taco-night" }))!;
    const session = await loadSession(db, WEEK, WEEK);
    expect(session.cards.length).toBeGreaterThanOrEqual(10);
    expect(session.cards.some((c) => c.id === tacos.id)).toBe(true);

    const favorite = session.cards.find((c) => c.id !== tacos.id)!;
    for (const who of [ids.Mom, ids.Kid, ids.Tween]) await castVote(db, WEEK, who, favorite.id, 2);
    await castVote(db, WEEK, ids.Kid, favorite.id, 4);
    expect((await weekVotes(db, WEEK)).filter((v) => v.recipeId === favorite.id)).toHaveLength(3);

    await applySuggestions(db, WEEK, WEEK, 0, { random: seededRandom(3), weather: false });
    const meals = [...(await loadMeals(db, "2026-10-11", "2026-10-17")).values()];
    expect(meals.some((m) => m.recipeId === tacos.id)).toBe(false);
    expect(meals.some((m) => m.recipeId === favorite.id)).toBe(true);
  });

  it("re-plans the planner's picks but not dinners picked on purpose", async () => {
    const tacos = (await getRecipe(db, { slug: "taco-night" }))!;
    await undoVeto(db, ids.Kid, WEEK, tacos.id);
    const chosen = (await getRecipe(db, { slug: "chicken-noodle-soup" })) ?? (await getRecipe(db, { slug: STARTER_RECIPES[0].slug }))!;
    await saveNight(db, "2026-10-15", 0, { recipeId: chosen.id, suggestionReason: "👨‍🍳 Tween's Chef's Pick" });
    await applySuggestions(db, WEEK, WEEK, 0, { random: seededRandom(11), weather: false, replaceSuggested: true });
    const meals = await loadMeals(db, "2026-10-11", "2026-10-17");
    expect(meals.get("2026-10-15")?.recipeId).toBe(chosen.id);
    expect(meals.get("2026-10-15")?.suggestionReason).toContain("Chef's Pick");
  });

  it("works out badge stats, including ratings a parent entered", async () => {
    const meal = (await loadMeals(db, "2026-10-12", "2026-10-12")).get("2026-10-12")!;
    await saveNight(db, "2026-10-12", 0, { status: "cooked" });
    await db.insert(rating).values({ plannedMealId: meal.id, recipeId: meal.recipeId!, memberId: ids.Kid, enteredByMemberId: ids.Mom, stars: 5, reasons: ["yummy"] });
    await db.insert(wheelSpin).values({ date: "2026-10-13", spunByMemberId: ids.Kid, chaos: "breakfast" });
    const stats = (await loadBadgeStats(db, [ids.Kid], "2026-10-13", 0)).get(ids.Kid)!;
    expect(stats).toMatchObject({ ratings: 1, fiveStars: 1, withReasons: 1, spins: 1, chaos: 1, vetoes: 1, streak: 1 });
    expect(stats.votes).toBeGreaterThanOrEqual(1);
  });
});
