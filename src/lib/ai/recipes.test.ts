import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { describeFamily, normalizeAiRecipe } = await import("./recipes");
type AiRecipe = Parameters<typeof normalizeAiRecipe>[0];

const base: AiRecipe = {
  title: "Grandma's Chili",
  description: "Cozy.",
  kind: "main",
  cuisine: "American",
  tags: ["comfort", "comfort"],
  method: "slow_cooker",
  activeMinutes: 20,
  totalMinutes: 10, // less than active: should be fixed
  baseServings: 6,
  spiceLevel: 7, // out of range: should be clamped
  spiceSplit: "  hot sauce at the table ",
  seasonFit: "cold",
  indoorMethod: null,
  healthCategory: "comfort",
  ingredients: [
    { name: "Ground Beef ", quantity: 2, unit: "lb", section: "meat", perishable: true, note: null, optional: false },
    { name: "salt", quantity: null, unit: "tsp", section: "spices", perishable: false, note: null, optional: false },
    { name: "hot sauce", quantity: 0, unit: "tbsp", section: "pantry", perishable: false, note: "chipotle", optional: true },
  ],
  steps: [
    { text: "Brown the beef.", timerMinutes: 8 },
    { text: "  ", timerMinutes: null },
    { text: "Simmer.", timerMinutes: 0 },
  ],
  variants: [
    {
      kind: "protein_swap",
      label: "Turkey chili",
      description: "",
      removes: ["ground beef", "not an ingredient"],
      adds: [{ name: "ground turkey", quantity: 2, unit: "lb", section: "meat", perishable: true, note: null, optional: false }],
      extraSteps: ["", "Use turkey instead."],
      extraActiveMinutes: 0,
      avoids: [" Ground Beef"],
    },
  ],
  pairsWith: ["baked-potatoes", "made-up-side"],
  notes: "  Freezes well. ",
  warnings: ["Can sizes were guessed."],
};

describe("normalizeAiRecipe", () => {
  const { recipe, notes, warnings } = normalizeAiRecipe(base, ["baked-potatoes"]);

  it("produces a valid recipe with tidy fields", () => {
    expect(recipe.slug).toBe("grandma-s-chili");
    expect(recipe.tags).toEqual(["comfort"]);
    expect(recipe.totalMinutes).toBe(20);
    expect(recipe.spiceLevel).toBe(3);
    expect(recipe.spiceSplit).toBe("hot sauce at the table");
    expect(notes).toBe("Freezes well.");
    expect(warnings).toEqual(["Can sizes were guessed."]);
  });

  it("cleans up ingredients and amounts", () => {
    expect(recipe.ingredients[0]).toMatchObject({ name: "ground beef", quantity: 2, unit: "lb" });
    expect(recipe.ingredients[1]).toMatchObject({ name: "salt", quantity: null, unit: "to_taste" });
    expect(recipe.ingredients[2]).toMatchObject({ quantity: null, note: "chipotle", optional: true });
  });

  it("drops empty steps and zero timers", () => {
    expect(recipe.steps).toEqual([{ text: "Brown the beef.", timerMinutes: 8 }, { text: "Simmer." }]);
  });

  it("keeps variant removals honest and lowercases avoids", () => {
    const swap = recipe.variants[0];
    expect(swap.removes).toEqual(["ground beef"]);
    expect(swap.avoids).toEqual(["ground beef"]);
    expect(swap.extraSteps).toEqual(["Use turkey instead."]);
    expect(swap.description).toBe("Turkey chili");
  });

  it("only pairs with sides that exist", () => {
    expect(recipe.pairsWith).toEqual(["baked-potatoes"]);
  });

  it("survives a recipe with no steps or ingredients", () => {
    const empty = normalizeAiRecipe({ ...base, steps: [], ingredients: [], variants: [] });
    expect(empty.recipe.steps).toHaveLength(1);
    expect(empty.warnings).toContain("No steps were found.");
    expect(empty.warnings).toContain("No ingredients were found.");
  });
});

describe("describeFamily", () => {
  it("describes needs without names", () => {
    const text = describeFamily({
      spiceTolerances: [3, 1, 0, 2],
      nopes: ["ground beef"],
      wantsHighProtein: true,
      wantsHealthySwaps: true,
      appliances: ["Grill", "Slow cooker"],
      weeknightActiveMinutes: 30,
      householdSize: 4,
      knownIngredients: ["yellow onion"],
      sides: [{ slug: "steamed-rice", title: "Steamed Rice" }],
      favorites: ["Taco Night"],
    });
    expect(text).toContain('"no heat at all" to "very spicy"');
    expect(text).toContain("ground beef");
    expect(text).toContain("protein_boost");
    expect(text).toContain("steamed-rice");
    expect(text).toContain("Taco Night");
  });
});

describe("ratings seen in a screenshot", () => {
  it("pulls the site, stars and count out of a short note", async () => {
    const { parseRatingText } = await import("./recipes");
    expect(parseRatingText("Allrecipes 4.8 12,345")).toEqual({ site: "Allrecipes", rating: 4.8, count: 12345 });
    expect(parseRatingText("Allrecipes ★ 4.7 (2,305 ratings)")).toEqual({ site: "Allrecipes", rating: 4.7, count: 2305 });
    expect(parseRatingText("Food Network 5 stars")).toEqual({ site: "Food Network", rating: 5, count: null });
    expect(parseRatingText(null)).toBeNull();
    expect(parseRatingText("Grandma's card")).toBeNull();
  });
});
