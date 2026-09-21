import type { Database } from "@/db";
import { STARTER_RECIPES } from "@/data/starter-recipes";
import { existingSlugs, saveRecipe } from "./store";

/**
 * Adds starter recipes that aren't in the library yet. Recipes a family
 * archived keep their row, so they are never re-added behind their back.
 */
export async function seedStarterRecipes(
  db: Database,
  onlySlugs?: string[],
): Promise<number> {
  const wanted = onlySlugs
    ? STARTER_RECIPES.filter((r) => onlySlugs.includes(r.slug))
    : STARTER_RECIPES;
  const present = await existingSlugs(
    db,
    wanted.map((r) => r.slug),
  );
  let added = 0;
  for (const starter of wanted) {
    if (present.has(starter.slug)) continue;
    await saveRecipe(db, starter, { source: "starter" });
    added++;
  }
  return added;
}
