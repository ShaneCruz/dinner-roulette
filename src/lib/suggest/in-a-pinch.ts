import {
  isStapleIngredient,
  rankForNight,
  type EngineContext,
  type EngineNight,
  type EngineRecipe,
} from "./engine";

/**
 * Dinner when there's no plan and no time — someone's just back from a game
 * and the question is "what can I make tonight with a quick stop at the
 * store?". Two things matter and nothing else does: how long it takes, and
 * how short the shopping list is. A dinner needing eleven things isn't fast,
 * however quickly it cooks.
 */

export type PinchPick = {
  recipe: EngineRecipe;
  /** What you'd have to pick up: everything that isn't a staple or optional */
  buy: string[];
  /** Why it suits tonight, from the usual scoring */
  reasons: string[];
};

/** Everything a recipe needs that isn't already in the cupboard. */
export function shoppingFor(recipe: EngineRecipe): string[] {
  return recipe.ingredients
    .filter((i) => !i.optional && i.section !== "spices" && !isStapleIngredient(i.name))
    .map((i) => i.name);
}

export function inAPinch(
  night: EngineNight,
  context: EngineContext,
  options: { maxMinutes?: number; limit?: number } = {},
): PinchPick[] {
  const maxMinutes = options.maxMinutes ?? 35;
  const byId = new Map(context.recipes.map((r) => [r.id, r]));
  // The night's own budget is about hands-on time, so line it up with how
  // long they said they have. Otherwise a "quick" night throws out the
  // 45-minute dinners before we get to look at them.
  const budget = maxMinutes <= 20 ? "quick" : maxMinutes <= 40 ? "normal" : "weekend";

  return rankForNight({ ...night, budget }, context, [])
    .filter((scored) => !scored.excluded)
    .map((scored) => ({ scored, recipe: byId.get(scored.recipeId) }))
    .filter((row): row is { scored: (typeof row)["scored"]; recipe: EngineRecipe } => Boolean(row.recipe))
    .filter((row) => row.recipe.totalMinutes <= maxMinutes)
    .map((row) => ({ recipe: row.recipe, buy: shoppingFor(row.recipe), reasons: row.scored.reasons, score: row.scored.score }))
    // The shortest shop wins; then the quickest; then whatever suits tonight best.
    .sort((a, b) => a.buy.length - b.buy.length || a.recipe.totalMinutes - b.recipe.totalMinutes || b.score - a.score)
    .slice(0, options.limit ?? 8)
    .map(({ recipe, buy, reasons }) => ({ recipe, buy, reasons }));
}
