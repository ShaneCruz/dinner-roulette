import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { recipe } from "@/db/schema";
import { aiEnabled } from "@/lib/ai/claude";
import { estimateNutrition } from "@/lib/ai/nutrition";
import { getRecipe } from "@/lib/recipes/store";

/** Estimates and saves nutrition for a recipe that doesn't have it yet. */
export async function ensureNutrition(db: Database, recipeId: string): Promise<boolean> {
  if (!aiEnabled()) return false;
  const found = await getRecipe(db, { id: recipeId });
  if (!found) return false;
  const [row] = await db.select({ nutrition: recipe.nutrition, updatedAt: recipe.updatedAt }).from(recipe).where(eq(recipe.id, recipeId));
  if (row?.nutrition) return false;
  const nutrition = await estimateNutrition(found);
  // Only save if nobody edited the recipe while we were estimating. Keep
  // updatedAt as it was: an estimate isn't an edit.
  await db
    .update(recipe)
    .set({ nutrition, updatedAt: sql`${recipe.updatedAt}` as unknown as Date })
    .where(
      and(
        eq(recipe.id, recipeId),
        isNull(recipe.nutrition),
        sql`date_trunc('milliseconds', ${recipe.updatedAt}) = ${row!.updatedAt.toISOString()}::timestamptz`,
      ),
    );
  return true;
}

/** Fills in nutrition for a few recipes that are missing it (run by the scheduler). */
export async function backfillNutrition(db: Database, limit = 6): Promise<number> {
  if (!aiEnabled()) return 0;
  const missing = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(isNull(recipe.nutrition), isNull(recipe.archivedAt)))
    .limit(limit);
  const results = await Promise.allSettled(missing.map((r) => ensureNutrition(db, r.id)));
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}
