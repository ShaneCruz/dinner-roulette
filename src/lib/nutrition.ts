import type { Nutrition } from "@/db/schema";

/** Adds up a dinner: the main plus its sides, one serving each. */
export function mealNutrition(parts: (Nutrition | null | undefined)[]): (Omit<Nutrition, "note" | "estimatedAt"> & { complete: boolean }) | null {
  const known = parts.filter((p): p is Nutrition => Boolean(p));
  if (!known.length) return null;
  const sum = (key: "calories" | "proteinG" | "carbsG" | "fiberG" | "fatG" | "sodiumMg") =>
    known.reduce((total, p) => total + p[key], 0);
  return {
    calories: sum("calories"),
    proteinG: sum("proteinG"),
    carbsG: sum("carbsG"),
    fiberG: sum("fiberG"),
    fatG: sum("fatG"),
    sodiumMg: sum("sodiumMg"),
    complete: known.length === parts.length,
  };
}

/** "≈ 610 cal · 42g protein · 55g carbs · 8g fiber" */
export function nutritionLine(n: { calories: number; proteinG: number; carbsG: number; fiberG: number }): string {
  return `≈ ${n.calories} cal · ${n.proteinG}g protein · ${n.carbsG}g carbs · ${n.fiberG}g fiber`;
}
