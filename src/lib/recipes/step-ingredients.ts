import type { IngredientInput } from "./schema";

// Words in ingredient names that don't identify the ingredient on their own.
const VAGUE = new Set(["fresh", "large", "small", "medium", "boneless", "skinless", "ground", "yellow", "white", "black", "sweet", "whole", "dried", "chopped", "shredded", "grated", "low", "sodium", "extra", "virgin", "kosher", "light", "dark", "red", "green"]);

/** Ingredients a step mentions, so the cook sees amounts without scrolling back. */
export function ingredientsForStep(step: string, ingredients: IngredientInput[]): number[] {
  const text = step.toLowerCase();
  const out: number[] = [];
  ingredients.forEach((ingredient, index) => {
    const name = ingredient.name.toLowerCase();
    const words = name.split(/[^a-z]+/).filter((w) => w.length >= 4 && !VAGUE.has(w));
    const stem = (w: string) => w.replace(/(es|s)$/, "");
    if (text.includes(name) || words.some((w) => new RegExp(`\\b${stem(w)}`).test(text))) out.push(index);
  });
  return out;
}
