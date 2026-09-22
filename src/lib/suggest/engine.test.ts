import { describe, expect, it } from "vitest";
import { STARTER_RECIPES } from "@/data/starter-recipes";
import { recipeInputSchema } from "@/lib/recipes/schema";
import {
  assignTurns,
  rankForNight,
  scoreRecipe,
  season,
  seededRandom,
  suggestWeek,
  type EngineContext,
  type EngineMember,
  type EngineRecipe,
  type EngineNight,
} from "./engine";

function toEngine(slug: string, overrides: Partial<EngineRecipe> = {}): EngineRecipe {
  const input = STARTER_RECIPES.find((r) => r.slug === slug);
  if (!input) throw new Error(slug);
  const r = recipeInputSchema.parse(input);
  return {
    id: r.slug,
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
    ingredients: r.ingredients,
    variants: r.variants,
    lastCooked: null,
    ...overrides,
  };
}

const member = (overrides: Partial<EngineMember> & Pick<EngineMember, "id" | "name">): EngineMember => ({
  role: "kid",
  spiceTolerance: 1,
  nopes: [],
  lovedRecipeIds: [],
  ratings: {},
  ...overrides,
});

const dad = member({ id: "dad", name: "Dad", role: "parent", spiceTolerance: 3 });
const mom = member({ id: "mom", name: "Mom", role: "parent", spiceTolerance: 1 });
const teen = member({ id: "teen", name: "Teen", nopes: ["ground beef"], usuallyAway: true });
const tween = member({ id: "tween", name: "Tween", spiceTolerance: 0 });
const kid = member({ id: "kid", name: "Kid", spiceTolerance: 2 });
const family = [dad, mom, teen, tween, kid];
const everyone = family.map((m) => m.id);

const allRecipes = STARTER_RECIPES.map((r) => toEngine(r.slug));

const settings = {
  defaultCooldownDays: 14,
  weeknightActiveMinutes: 30,
  healthyNightsTarget: 5,
  grillCaps: { summer: 3, shoulder: 2, winter: 1 },
};

const context = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  members: family,
  recipes: allRecipes,
  settings,
  ...overrides,
});

const night = (overrides: Partial<EngineNight> = {}): EngineNight => ({
  date: "2026-10-14",
  eaterIds: everyone,
  budget: "normal",
  ...overrides,
});

const score = (slug: string, n: EngineNight, ctx = context(), chosen: { date: string; recipeId: string }[] = []) =>
  scoreRecipe(ctx.recipes.find((r) => r.slug === slug)!, n, ctx, chosen);

describe("hard filters", () => {
  it("keeps a dinner when a swap covers someone's nope", () => {
    const tacos = score("taco-night", night());
    expect(tacos.excluded).toBeNull();
    expect(tacos.reasons.join(" ")).toContain("for Teen");
  });

  it("drops a dinner when a nope has no swap", () => {
    const noSwap = context({
      recipes: allRecipes.map((r) => (r.slug === "taco-night" ? { ...r, variants: [] } : r)),
    });
    expect(score("taco-night", night(), noSwap).excluded).toBe("Teen doesn't eat ground beef");
  });

  it("drops spicy dinners that can't be made mild for the most sensitive eater", () => {
    const spicy = context({
      recipes: allRecipes.map((r) =>
        r.slug === "chicken-quesadillas" ? { ...r, spiceLevel: 2, spiceSplit: null, variants: [] } : r,
      ),
    });
    expect(score("chicken-quesadillas", night(), spicy).excluded).toBe("Too spicy for Tween");
    // Fine when the tween is at practice
    expect(score("chicken-quesadillas", night({ eaterIds: ["dad", "kid"] }), spicy).excluded).toBeNull();
  });

  it("respects the time budget", () => {
    expect(score("slow-cooker-pot-roast", night()).excluded).toBe("Needs more time than tonight has");
    expect(score("slow-cooker-pot-roast", night({ budget: "hands_off" })).excluded).toBeNull();
  });

  it("waits out the cooldown, but brings big hits back sooner", () => {
    const recent = context({
      recipes: allRecipes.map((r) => (r.slug === "chicken-souvlaki" ? { ...r, lastCooked: "2026-10-06" } : r)),
    });
    expect(score("chicken-souvlaki", night(), recent).excluded).toBe("Had it 8 days ago");

    const loved = context({
      recipes: recent.recipes,
      members: family.map((m) => ({ ...m, ratings: { "chicken-souvlaki": 5 } })),
    });
    expect(score("chicken-souvlaki", night(), loved).excluded).toBeNull();
  });

  it("never repeats a dinner within the week", () => {
    expect(
      score("taco-night", night(), context(), [{ date: "2026-10-12", recipeId: "taco-night" }]).excluded,
    ).toBe("Already on the plan this week");
  });

  it("limits grill nights in winter, falling back to indoor cooking", () => {
    const winter = night({ date: "2027-01-13" });
    const grilledAlready = [{ date: "2027-01-11", recipeId: "grilled-chicken" }];
    const steak = score("grilled-steak", winter, context(), grilledAlready);
    expect(steak.excluded).toBeNull();
    expect(steak.reasons.join(" ")).toContain("indoors");

    const noIndoor = context({
      recipes: allRecipes.map((r) => (r.slug === "grilled-steak" ? { ...r, indoorMethod: null } : r)),
    });
    expect(score("grilled-steak", winter, noIndoor, grilledAlready).excluded).toBe(
      "Grill nights are used up this week",
    );
  });

  it("steers grill nights indoors in bad weather", () => {
    const stormy = night({ date: "2026-07-14", weather: { tempMaxF: 70, precipChance: 90 } });
    const noIndoor = context({
      recipes: allRecipes.map((r) => (r.slug === "grilled-steak" ? { ...r, indoorMethod: null } : r)),
    });
    expect(score("grilled-steak", stormy, noIndoor).excluded).toBe("Bad grilling weather");
  });
});

describe("scoring", () => {
  it("puts the favored kid's loved dinner on top", () => {
    const ctx = context({
      members: family.map((m) => (m.id === "kid" ? { ...m, lovedRecipeIds: ["chicken-quesadillas"] } : m)),
    });
    const ranked = rankForNight(night({ favoredMemberId: "kid" }), ctx, []);
    expect(ranked[0].recipeId).toBe("chicken-quesadillas");
    expect(ranked[0].reasons[0]).toBe("Kid's pick: loves it");
  });

  it("sinks dinners someone hated", () => {
    const ctx = context({
      members: family.map((m) => (m.id === "tween" ? { ...m, ratings: { "avgolemono-soup": 1 } } : m)),
    });
    const hated = scoreRecipe(ctx.recipes.find((r) => r.slug === "avgolemono-soup")!, night(), ctx, []);
    const neutral = score("avgolemono-soup", night());
    expect(hated.score).toBeLessThan(neutral.score);
    expect(hated.reasons.join(" ")).toContain("wasn't a fan");
  });

  it("favors healthy dinners when the week is short on them", () => {
    const comfortWeek = [
      { date: "2026-10-12", recipeId: "baked-mostaccioli" },
      { date: "2026-10-13", recipeId: "chicken-parm-sandwiches" },
    ];
    const healthy = score("chicken-souvlaki", night(), context(), comfortWeek);
    expect(healthy.reasons).toContain("Healthy night");
  });

  it("likes dinners that share fresh ingredients with the week", () => {
    const withPeppers = score("taco-night", night(), context(), [{ date: "2026-10-12", recipeId: "chicken-quesadillas" }]);
    expect(withPeppers.reasons.some((r) => r.startsWith("Shares"))).toBe(true);
  });

  it("avoids the same protein or cuisine two nights in a row", () => {
    const afterSkewers = [{ date: "2026-10-13", recipeId: "grilled-skewers" }];
    const chicken = score("grilled-chicken", night(), context(), afterSkewers);
    const later = score("grilled-chicken", night(), context(), [{ date: "2026-10-11", recipeId: "grilled-skewers" }]);
    expect(chicken.score).toBeLessThan(later.score);

    const afterBolognese = [{ date: "2026-10-13", recipeId: "spaghetti-bolognese" }];
    const mostaccioli = score("baked-mostaccioli", night({ budget: "weekend" }), context(), afterBolognese);
    const tacos = score("taco-night", night({ budget: "weekend" }), context(), afterBolognese);
    expect(mostaccioli.score).toBeLessThan(tacos.score);
  });

  it("knows the seasons", () => {
    expect(season("2026-12-05")).toBe("winter");
    expect(season("2026-07-05")).toBe("summer");
    expect(season("2026-10-05")).toBe("shoulder");
  });
});

describe("turns", () => {
  const nights = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"].map((date) =>
    night({ date, eaterIds: ["dad", "mom", "tween", "kid"] }),
  );

  it("rotates between the kids who are eating", () => {
    const turns = assignTurns(nights, family, []);
    const order = nights.map((n) => turns.get(n.date)!.memberId);
    expect(new Set(order)).toEqual(new Set(["tween", "kid"]));
    expect(order[0]).not.toBe(order[1]);
  });

  it("gives the kid who's had fewer recent turns the next one", () => {
    const turns = assignTurns(nights.slice(0, 1), family, [
      { date: "2026-10-01", memberId: "kid" },
      { date: "2026-10-03", memberId: "kid" },
    ]);
    expect(turns.get("2026-10-11")!.memberId).toBe("tween");
  });

  it("gives a boarder First Pick on their first night home", () => {
    const home = [night({ date: "2026-11-21", eaterIds: everyone })];
    const turns = assignTurns(home, family, [], { teen: "2026-11-21" });
    expect(turns.get("2026-11-21")).toEqual({ memberId: "teen", firstPick: true });
  });
});

describe("suggestWeek", () => {
  const weekNights: EngineNight[] = [
    night({ date: "2026-10-11", budget: "weekend" }),
    night({ date: "2026-10-12" }),
    night({ date: "2026-10-13", budget: "quick", eaterIds: ["dad", "mom", "kid"] }),
    night({ date: "2026-10-14", budget: "hands_off" }),
    night({ date: "2026-10-15" }),
  ];

  it("fills every night without repeats or rule breaks", () => {
    const picks = suggestWeek(weekNights, context(), [], { random: seededRandom(42) });
    expect(picks).toHaveLength(weekNights.length);
    expect(new Set(picks.map((p) => p.recipeId)).size).toBe(picks.length);
    for (const pick of picks) {
      const n = weekNights.find((w) => w.date === pick.date)!;
      const check = scoreRecipe(allRecipes.find((r) => r.id === pick.recipeId)!, n, context(), []);
      expect(check.excluded, `${pick.date} ${pick.recipeId}`).toBeNull();
      expect(pick.reason.length).toBeGreaterThan(0);
    }
  });

  it("is repeatable with the same seed and varies with another", () => {
    const a = suggestWeek(weekNights, context(), [], { random: seededRandom(7) }).map((p) => p.recipeId);
    const b = suggestWeek(weekNights, context(), [], { random: seededRandom(7) }).map((p) => p.recipeId);
    expect(a).toEqual(b);
    const variants = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) =>
        suggestWeek(weekNights, context(), [], { random: seededRandom(seed) }).map((p) => p.recipeId).join(),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it("adds a side the main pairs with", () => {
    const picks = suggestWeek([night({ date: "2026-10-12" })], context({
      recipes: allRecipes.filter((r) => r.slug === "grilled-steak" || r.kind === "side"),
    }), [], { random: seededRandom(3) });
    expect(picks[0].recipeId).toBe("grilled-steak");
    expect(picks[0].sideRecipeIds).toHaveLength(1);
  });

  it("can avoid the current dinner when asking for another idea", () => {
    const first = suggestWeek([night()], context(), [], { random: seededRandom(1) })[0];
    const again = suggestWeek([night()], context(), [], { random: seededRandom(1), avoid: { [first.date]: first.recipeId } })[0];
    expect(again.recipeId).not.toBe(first.recipeId);
  });
});
