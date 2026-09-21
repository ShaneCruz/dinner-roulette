import type { IngredientInput, Unit } from "./schema";

export type Amount = { quantity: number | null; unit: Unit };

const TSP_PER: Partial<Record<Unit, number>> = { tsp: 1, tbsp: 3, cup: 48 };
const OZ_PER: Partial<Record<Unit, number>> = { oz: 1, lb: 16 };

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Volume in teaspoons shown in the friendliest kitchen unit. */
function friendlyVolume(tsp: number): Amount {
  if (tsp >= 12) {
    const cups = tsp / 48;
    // Thirds read better than eighths when they're closer.
    const byQuarter = roundTo(cups, 0.25);
    const byThird = roundTo(cups, 1 / 3);
    const quantity =
      Math.abs(byThird - cups) < Math.abs(byQuarter - cups) - 1e-9 ? byThird : byQuarter;
    return { quantity, unit: "cup" };
  }
  if (tsp >= 3) return { quantity: roundTo(tsp / 3, 0.5), unit: "tbsp" };
  return { quantity: Math.max(roundTo(tsp, 0.125), 0.125), unit: "tsp" };
}

function friendlyWeight(oz: number): Amount {
  if (oz >= 16) return { quantity: roundTo(oz / 16, 0.25), unit: "lb" };
  return { quantity: Math.max(roundTo(oz, 0.5), 0.5), unit: "oz" };
}

/** Scales an amount by `factor`, re-expressing it in a sensible unit. */
export function scaleAmount(amount: Amount, factor: number): Amount {
  const { quantity, unit } = amount;
  if (quantity === null || unit === "to_taste" || unit === "pinch") {
    return { quantity, unit };
  }
  const scaled = quantity * factor;
  const tsp = TSP_PER[unit];
  if (tsp !== undefined) return friendlyVolume(scaled * tsp);
  const oz = OZ_PER[unit];
  if (oz !== undefined) return friendlyWeight(scaled * oz);
  if (unit === "g" || unit === "ml") return { quantity: Math.max(roundTo(scaled, 5), 5), unit };
  if (unit === "kg" || unit === "l") return { quantity: roundTo(scaled, 0.05), unit };
  // Countable things: halves are fine in a recipe ("1 1/2 onions").
  return { quantity: Math.max(roundTo(scaled, 0.5), 0.5), unit };
}

export function scaleIngredient(ingredient: IngredientInput, factor: number): IngredientInput {
  if (factor === 1) return ingredient;
  return { ...ingredient, ...scaleAmount(ingredient, factor) };
}

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

/** 1.5 -> "1½", 0.333 -> "⅓", 2 -> "2" */
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity + 1e-9);
  const rest = quantity - whole;
  if (rest < 0.02) return String(whole);
  const match = FRACTIONS.find(([value]) => Math.abs(value - rest) < 0.02);
  if (match) return whole > 0 ? `${whole}${match[1]}` : match[1];
  return String(Math.round(quantity * 100) / 100);
}

const UNIT_LABELS: Record<Unit, [singular: string, plural: string]> = {
  tsp: ["tsp", "tsp"],
  tbsp: ["tbsp", "tbsp"],
  cup: ["cup", "cups"],
  fl_oz: ["fl oz", "fl oz"],
  oz: ["oz", "oz"],
  lb: ["lb", "lb"],
  g: ["g", "g"],
  kg: ["kg", "kg"],
  ml: ["ml", "ml"],
  l: ["L", "L"],
  whole: ["", ""],
  clove: ["clove", "cloves"],
  slice: ["slice", "slices"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  package: ["package", "packages"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  stalk: ["stalk", "stalks"],
  sprig: ["sprig", "sprigs"],
  pinch: ["pinch", "pinches"],
  to_taste: ["", ""],
};

export function formatAmount({ quantity, unit }: Amount): string {
  if (unit === "to_taste") return "to taste";
  if (quantity === null) return unit === "pinch" ? "a pinch" : "";
  const [singular, plural] = UNIT_LABELS[unit];
  const label = quantity > 1 + 1e-9 ? plural : singular;
  return [formatQuantity(quantity), label].filter(Boolean).join(" ");
}
