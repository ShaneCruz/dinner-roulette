import { formatAmount, type Amount } from "@/lib/recipes/scale";
import type { IngredientInput, StoreSection, Unit, VariantInput } from "@/lib/recipes/schema";

/**
 * Turns a week of planned meals into one shopping list.
 *
 * Variations are bought on top of the base recipe rather than instead of it:
 * if the parents have zucchini noodles, the kids still need pasta. That
 * over-buys a little for swaps that replace an ingredient for everyone, but
 * never leaves you short in the store.
 */

export type GroceryMealInput = {
  date: string;
  title: string;
  baseServings: number;
  servings: number;
  ingredients: IngredientInput[];
  /** Variations in use for this meal, with how many people get each */
  variants: { variant: VariantInput; portions: number }[];
};

export type GroceryLine = {
  key: string;
  name: string;
  quantity: number | null;
  unit: Unit;
  section: StoreSection;
  isStaple: boolean;
  sources: { recipeTitle: string; date: string }[];
};

const TSP_PER: Partial<Record<Unit, number>> = {
  tsp: 1,
  tbsp: 3,
  cup: 48,
  fl_oz: 6,
  ml: 1 / 4.929,
  l: 1000 / 4.929,
};
const OZ_PER: Partial<Record<Unit, number>> = { oz: 1, lb: 16, g: 1 / 28.35, kg: 1000 / 28.35 };

/** Things most kitchens have; listed separately as "check you have these". */
const STAPLES = new Set([
  "kosher salt",
  "salt",
  "black pepper",
  "olive oil",
  "vegetable oil",
  "canola oil",
  "cooking spray",
  "all-purpose flour",
  "granulated sugar",
  "sugar",
  "brown sugar",
  "water",
]);

type Family = "volume" | "weight" | Unit;

function family(unit: Unit): Family {
  if (TSP_PER[unit] !== undefined) return "volume";
  if (OZ_PER[unit] !== undefined) return "weight";
  return unit;
}

function toBase(quantity: number, unit: Unit): number {
  return quantity * (TSP_PER[unit] ?? OZ_PER[unit] ?? 1);
}

type Accumulator = {
  name: string;
  family: Family;
  /** Sum in teaspoons, ounces, or the unit itself */
  total: number;
  hasQuantity: boolean;
  unit: Unit;
  section: StoreSection;
  sources: Map<string, { recipeTitle: string; date: string }>;
};

export function groceryKey(name: string, unit: Unit): string {
  return `${name.trim().toLowerCase()}|${family(unit)}`;
}

/** Round up to amounts you can actually buy. */
function buyable(acc: Accumulator): Amount {
  if (!acc.hasQuantity) return { quantity: null, unit: acc.unit === "pinch" ? "pinch" : "to_taste" };
  if (acc.family === "volume") {
    const tsp = acc.total;
    if (tsp >= 12) return { quantity: Math.ceil((tsp / 48) * 4 - 1e-9) / 4, unit: "cup" };
    if (tsp >= 3) return { quantity: Math.ceil((tsp / 3) * 2 - 1e-9) / 2, unit: "tbsp" };
    return { quantity: Math.max(Math.ceil(tsp * 4 - 1e-9) / 4, 0.25), unit: "tsp" };
  }
  if (acc.family === "weight") {
    if (acc.total >= 12) return { quantity: Math.ceil((acc.total / 16) * 4) / 4, unit: "lb" };
    return { quantity: Math.ceil(acc.total), unit: "oz" };
  }
  return { quantity: Math.ceil(acc.total - 1e-9), unit: acc.unit };
}

function add(
  lines: Map<string, Accumulator>,
  ingredient: IngredientInput,
  factor: number,
  source: { recipeTitle: string; date: string },
) {
  const key = groceryKey(ingredient.name, ingredient.unit);
  let acc = lines.get(key);
  if (!acc) {
    acc = {
      name: ingredient.name.trim().toLowerCase(),
      family: family(ingredient.unit),
      total: 0,
      hasQuantity: false,
      unit: ingredient.unit,
      section: ingredient.section,
      sources: new Map(),
    };
    lines.set(key, acc);
  }
  if (ingredient.quantity !== null && ingredient.unit !== "to_taste" && ingredient.unit !== "pinch") {
    acc.total += toBase(ingredient.quantity * factor, ingredient.unit);
    acc.hasQuantity = true;
  }
  acc.sources.set(`${source.date}|${source.recipeTitle}`, source);
}

export function buildGroceryList(meals: GroceryMealInput[]): GroceryLine[] {
  const lines = new Map<string, Accumulator>();

  for (const meal of meals) {
    const source = { recipeTitle: meal.title, date: meal.date };
    const factor = meal.servings / meal.baseServings;
    for (const ingredient of meal.ingredients) {
      // Optional extras (hot sauce for one person) are still worth buying.
      add(lines, ingredient, factor, source);
    }
    for (const { variant, portions } of meal.variants) {
      if (portions <= 0) continue;
      const variantFactor = portions / meal.baseServings;
      for (const ingredient of variant.adds) add(lines, ingredient, variantFactor, source);
    }
  }

  return [...lines.entries()]
    .map(([key, acc]) => {
      const amount = buyable(acc);
      return {
        key,
        name: acc.name,
        quantity: amount.quantity,
        unit: amount.unit,
        section: acc.section,
        isStaple: STAPLES.has(acc.name) || acc.section === "spices" || !acc.hasQuantity,
        sources: [...acc.sources.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatGroceryAmount(line: { quantity: number | null; unit: string }): string {
  if (line.quantity === null) return "";
  return formatAmount({ quantity: line.quantity, unit: line.unit as Unit });
}
