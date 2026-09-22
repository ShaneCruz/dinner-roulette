import "server-only";
import type { Database } from "@/db";
import type { Recipe } from "@/lib/recipes/schema";
import { saveRecipe, slugify, uniqueSlug } from "@/lib/recipes/store";

/**
 * Saves an AI-made recipe as a draft: it shows up with a "check it over"
 * banner and isn't suggested for dinners until someone saves it.
 */
export async function saveDraftRecipe(
  db: Database,
  recipe: Recipe,
  options: {
    source: "ai" | "import";
    sourceUrl?: string | null;
    notes: string | null;
    warnings: string[];
    createdByMemberId: string;
  },
): Promise<string> {
  const slug = await uniqueSlug(db, slugify(recipe.title));
  const check = options.warnings.length ? `Double-check: ${options.warnings.join(" ")}` : null;
  await saveRecipe(
    db,
    { ...recipe, slug },
    {
      source: options.source,
      sourceUrl: options.sourceUrl ?? null,
      status: "draft",
      notes: [options.notes, check].filter(Boolean).join("\n\n") || null,
      createdByMemberId: options.createdByMemberId,
    },
  );
  return slug;
}
