import { describe, expect, it } from "vitest";
import type { IngredientInput, VariantInput } from "@/lib/recipes/schema";
import { buildGroceryList, groceryKey, type GroceryMealInput } from "./build";

const ing = (overrides: Partial<IngredientInput> & Pick<IngredientInput, "name">): IngredientInput => ({
  quantity: 1,
  unit: "whole",
  section: "produce",
  perishable: true,
  ...overrides,
});

const meal = (overrides: Partial<GroceryMealInput>): GroceryMealInput => ({
  date: "2026-09-21",
  title: "Dinner",
  baseServings: 5,
  servings: 5,
  ingredients: [],
  variants: [],
  ...overrides,
});

const byName = (lines: ReturnType<typeof buildGroceryList>, name: string) =>
  lines.find((l) => l.name === name);

describe("buildGroceryList", () => {
  it("merges the same ingredient across meals and remembers which meals use it", () => {
    const lines = buildGroceryList([
      meal({ title: "Tacos", date: "2026-09-21", ingredients: [ing({ name: "bell pepper", quantity: 2 })] }),
      meal({ title: "Sausage and peppers", date: "2026-09-23", ingredients: [ing({ name: "Bell Pepper", quantity: 3 })] }),
    ]);
    const peppers = byName(lines, "bell pepper")!;
    expect(peppers.quantity).toBe(5);
    expect(peppers.sources.map((s) => s.recipeTitle)).toEqual(["Tacos", "Sausage and peppers"]);
  });

  it("adds volumes across units and rounds up", () => {
    const lines = buildGroceryList([
      meal({ ingredients: [ing({ name: "shredded cheddar", quantity: 2, unit: "cup", section: "dairy" })] }),
      meal({ ingredients: [ing({ name: "shredded cheddar", quantity: 4, unit: "tbsp", section: "dairy" })] }),
    ]);
    expect(byName(lines, "shredded cheddar")).toMatchObject({ quantity: 2.25, unit: "cup" });
  });

  it("combines ounces and pounds into pounds", () => {
    const lines = buildGroceryList([
      meal({ ingredients: [ing({ name: "ground beef", quantity: 1.5, unit: "lb", section: "meat" })] }),
      meal({ ingredients: [ing({ name: "ground beef", quantity: 8, unit: "oz", section: "meat" })] }),
    ]);
    expect(byName(lines, "ground beef")).toMatchObject({ quantity: 2, unit: "lb" });
  });

  it("keeps incompatible units on separate lines", () => {
    const lines = buildGroceryList([
      meal({ ingredients: [ing({ name: "garlic", quantity: 3, unit: "clove" })] }),
      meal({ ingredients: [ing({ name: "garlic", quantity: 1, unit: "head" })] }),
    ]);
    expect(lines.filter((l) => l.name === "garlic")).toHaveLength(2);
    expect(groceryKey("Garlic", "clove")).not.toBe(groceryKey("garlic", "head"));
  });

  it("scales by servings and rounds countable things up", () => {
    const lines = buildGroceryList([
      meal({ servings: 7, ingredients: [ing({ name: "yellow onion", quantity: 1 })] }),
    ]);
    expect(byName(lines, "yellow onion")!.quantity).toBe(2); // 1.4 onions
  });

  it("buys variation extras for the people who get them", () => {
    const zoodles: VariantInput = {
      kind: "healthy",
      label: "Zucchini noodles",
      description: "",
      removes: ["spaghetti"],
      adds: [ing({ name: "zucchini", quantity: 5 })],
      extraSteps: [],
      extraActiveMinutes: 0,
      avoids: [],
    };
    const lines = buildGroceryList([
      meal({
        ingredients: [ing({ name: "spaghetti", quantity: 1, unit: "lb", section: "pantry", perishable: false })],
        variants: [{ variant: zoodles, portions: 2 }],
      }),
    ]);
    // Pasta is still bought for the kids; zucchini for two of five portions.
    expect(byName(lines, "spaghetti")).toBeDefined();
    expect(byName(lines, "zucchini")!.quantity).toBe(2);
  });

  it("marks pantry staples and to-taste items", () => {
    const lines = buildGroceryList([
      meal({
        ingredients: [
          ing({ name: "kosher salt", quantity: null, unit: "to_taste", section: "spices", perishable: false }),
          ing({ name: "olive oil", quantity: 2, unit: "tbsp", section: "spices", perishable: false }),
          ing({ name: "lemon", quantity: 2 }),
        ],
      }),
    ]);
    expect(byName(lines, "kosher salt")).toMatchObject({ isStaple: true, quantity: null });
    expect(byName(lines, "olive oil")!.isStaple).toBe(true);
    expect(byName(lines, "lemon")!.isStaple).toBe(false);
  });
});
