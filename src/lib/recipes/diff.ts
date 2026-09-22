import { formatAmount } from "./scale";
import type { IngredientInput, Recipe } from "./schema";

export type IngredientChange =
  | { type: "added"; name: string; to: string }
  | { type: "removed"; name: string; from: string }
  | { type: "changed"; name: string; from: string; to: string };

const amount = (i: IngredientInput) => (i.unit === "to_taste" ? "to taste" : formatAmount(i)) + (i.note ? ` (${i.note})` : "");

/** What a proposed recipe changes, in plain terms for a parent to review. */
export function diffRecipes(before: Recipe, after: Recipe) {
  const ingredients: IngredientChange[] = [];
  const oldByName = new Map(before.ingredients.map((i) => [i.name, i]));
  const newByName = new Map(after.ingredients.map((i) => [i.name, i]));
  for (const [name, next] of newByName) {
    const prev = oldByName.get(name);
    if (!prev) ingredients.push({ type: "added", name, to: amount(next) });
    else if (amount(prev) !== amount(next)) ingredients.push({ type: "changed", name, from: amount(prev), to: amount(next) });
  }
  for (const [name, prev] of oldByName) {
    if (!newByName.has(name)) ingredients.push({ type: "removed", name, from: amount(prev) });
  }

  const facts: string[] = [];
  if (before.baseServings !== after.baseServings) facts.push(`Serves ${before.baseServings} → ${after.baseServings}`);
  if (before.activeMinutes !== after.activeMinutes) facts.push(`Hands-on ${before.activeMinutes} → ${after.activeMinutes} min`);
  if (before.totalMinutes !== after.totalMinutes) facts.push(`Total ${before.totalMinutes} → ${after.totalMinutes} min`);
  if (before.spiceLevel !== after.spiceLevel) facts.push(`Spice ${before.spiceLevel} → ${after.spiceLevel}`);
  if (before.title !== after.title) facts.push(`Renamed “${after.title}”`);

  const stepText = (r: Recipe) => r.steps.map((s) => `${s.text}|${s.timerMinutes ?? ""}`).join("\n");
  return { ingredients, facts, stepsChanged: stepText(before) !== stepText(after) };
}
