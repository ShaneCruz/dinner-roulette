import "server-only";
import { z } from "zod";
import type { Nutrition } from "@/db/schema";
import { formatAmount } from "@/lib/recipes/scale";
import type { Recipe } from "@/lib/recipes/schema";
import { structured } from "./claude";

const nutritionSchema = z.object({
  calories: z.number().describe("kcal per serving"),
  proteinG: z.number(),
  carbsG: z.number(),
  fiberG: z.number(),
  fatG: z.number(),
  sodiumMg: z.number(),
  note: z.string().nullable().describe("The single biggest assumption, at most 12 words, or null"),
});

/**
 * Estimates nutrition for one serving from the ingredient list, the way a
 * dietitian would with USDA-style reference values. Approximate by design.
 */
export async function estimateNutrition(recipe: Pick<Recipe, "title" | "baseServings" | "ingredients" | "steps">): Promise<Nutrition> {
  const lines = recipe.ingredients.map((i) => {
    const amount = i.unit === "to_taste" ? "to taste" : formatAmount(i);
    return `- ${amount} ${i.name}${i.note ? ` (${i.note})` : ""}${i.optional ? " [optional, leave out]" : ""}`;
  });
  const result = await structured({
    system:
      "You estimate nutrition for home recipes from their ingredient lists, like a careful dietitian using USDA reference values. Assume common grocery-store versions (e.g. 85% lean ground beef unless stated, whole milk unless stated), cooked portions as served, and that optional ingredients are left out. Count oil used for cooking, not oil discarded. Round sensibly. Give values for ONE serving: the whole recipe divided by the number of servings.",
    content: `Recipe: ${recipe.title}\nServings: ${recipe.baseServings}\n\nIngredients:\n${lines.join("\n")}\n\nMethod, briefly: ${recipe.steps
      .map((s) => s.text)
      .join(" ")
      .slice(0, 1500)}`,
    schema: nutritionSchema,
    effort: "low",
    maxTokens: 4000,
  });
  const round = (n: number) => Math.max(0, Math.round(n));
  return {
    calories: round(result.calories),
    proteinG: round(result.proteinG),
    carbsG: round(result.carbsG),
    fiberG: round(result.fiberG),
    fatG: round(result.fatG),
    sodiumMg: round(result.sodiumMg),
    note: result.note?.trim() || null,
    estimatedAt: new Date().toISOString(),
  };
}
