import { describe, expect, it } from "vitest";
import type { EngineContext, EngineMember, EngineNight, EngineRecipe } from "./engine";
import { inAPinch, shoppingFor } from "./in-a-pinch";

const ing = (name: string, extra: Partial<EngineRecipe["ingredients"][number]> = {}) => ({
  name,
  perishable: true,
  ...extra,
});

const recipe = (overrides: Partial<EngineRecipe> & Pick<EngineRecipe, "id" | "totalMinutes">): EngineRecipe => ({
  slug: overrides.id,
  title: overrides.id,
  kind: "main",
  cuisine: "american",
  tags: [],
  method: "stovetop",
  activeMinutes: Math.min(overrides.totalMinutes, 20),
  spiceLevel: 0,
  spiceSplit: null,
  seasonFit: "any",
  indoorMethod: null,
  healthCategory: "balanced",
  cooldownDays: null,
  pairsWith: [],
  ingredients: [],
  variants: [],
  lastCooked: null,
  ...overrides,
});

const mum: EngineMember = {
  id: "m1",
  name: "Jamie",
  role: "parent",
  spiceTolerance: 1,
  nopes: [],
  lovedRecipeIds: [],
  ratings: {},
};

const night: EngineNight = { date: "2026-09-23", eaterIds: ["m1"], budget: "quick" };

const context = (recipes: EngineRecipe[]): EngineContext => ({
  members: [mum],
  recipes,
  settings: { defaultCooldownDays: 14, weeknightActiveMinutes: 30, healthyNightsTarget: 5, grillCaps: { summer: 3, shoulder: 2, winter: 1 } },
});

describe("what you'd actually have to buy", () => {
  it("leaves out the things already in the cupboard", () => {
    const r = recipe({
      id: "omelette",
      totalMinutes: 15,
      ingredients: [
        ing("eggs"),
        ing("cheddar"),
        ing("kosher salt"),
        ing("olive oil"),
        ing("smoked paprika", { section: "spices" }),
        ing("chives", { optional: true }),
      ],
    });
    expect(shoppingFor(r)).toEqual(["eggs", "cheddar"]);
  });
});

describe("dinner in a pinch", () => {
  const short = recipe({ id: "short-list", totalMinutes: 30, ingredients: [ing("eggs"), ing("bread")] });
  const long = recipe({
    id: "long-list",
    totalMinutes: 20,
    ingredients: [ing("a"), ing("b"), ing("c"), ing("d"), ing("e")],
  });
  const slow = recipe({ id: "slow", totalMinutes: 90, ingredients: [ing("beef")] });

  it("puts the shortest shopping list first, even when it cooks slower", () => {
    const picks = inAPinch(night, context([long, short, slow]));
    expect(picks.map((p) => p.recipe.id)).toEqual(["short-list", "long-list"]);
    expect(picks[0].buy).toEqual(["eggs", "bread"]);
  });

  it("drops anything that won't be ready in time", () => {
    expect(inAPinch(night, context([slow])).map((p) => p.recipe.id)).toEqual([]);
    expect(inAPinch(night, context([slow]), { maxMinutes: 120 }).map((p) => p.recipe.id)).toEqual(["slow"]);
  });

  it("breaks a tie on the shopping list with the clock", () => {
    const quicker = recipe({ id: "quicker", totalMinutes: 10, ingredients: [ing("eggs"), ing("bread")] });
    const picks = inAPinch(night, context([short, quicker]));
    expect(picks.map((p) => p.recipe.id)).toEqual(["quicker", "short-list"]);
  });

  it("respects what people won't eat", () => {
    const fussy: EngineMember = { ...mum, id: "k1", name: "Kaela", role: "kid", nopes: ["ground beef"] };
    const beefy = recipe({ id: "beefy", totalMinutes: 20, ingredients: [ing("ground beef")] });
    const picks = inAPinch(
      { ...night, eaterIds: ["k1"] },
      { ...context([beefy, short]), members: [fussy] },
    );
    expect(picks.map((p) => p.recipe.id)).not.toContain("beefy");
  });
});
