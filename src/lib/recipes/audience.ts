import type { Recipe, VariantInput } from "./schema";

export type AudienceMember = {
  id: string;
  name: string;
  spiceTolerance: number;
  prefersHighProtein: boolean;
  wantsHealthySwaps: boolean;
  /** Ingredient keywords this person never eats */
  nopes: string[];
};

export function ingredientMatches(ingredientName: string, keyword: string): boolean {
  return ingredientName.toLowerCase().includes(keyword.trim().toLowerCase());
}

/** Who a variant is for, by name. */
export function variantAudience(
  recipe: Pick<Recipe, "spiceLevel">,
  variant: VariantInput,
  members: AudienceMember[],
): AudienceMember[] {
  switch (variant.kind) {
    case "healthy":
      return members.filter((m) => m.wantsHealthySwaps);
    case "protein_boost":
      return members.filter((m) => m.prefersHighProtein);
    case "mild":
      return members.filter((m) => m.spiceTolerance < Math.max(recipe.spiceLevel, 1));
    case "protein_swap":
    case "kid":
      return members.filter((m) =>
        m.nopes.some((nope) => variant.avoids.some((avoided) => ingredientMatches(avoided, nope))),
      );
  }
}

/** People who want the extra heat described by `spiceSplit`. */
export function heatSeekers(members: AudienceMember[]): AudienceMember[] {
  return members.filter((m) => m.spiceTolerance >= 2);
}

/**
 * Hard nopes the base recipe hits, and whether some variant covers them.
 * "Kaela: ground beef (covered by Chicken tacos)".
 */
export function nopeConflicts(
  recipe: Pick<Recipe, "ingredients" | "variants">,
  members: AudienceMember[],
): { member: AudienceMember; ingredient: string; coveredBy: string | null }[] {
  const conflicts = [];
  for (const member of members) {
    for (const nope of member.nopes) {
      const hit = recipe.ingredients.find((i) => !i.optional && ingredientMatches(i.name, nope));
      if (!hit) continue;
      const cover = recipe.variants.find((v) =>
        v.avoids.some((avoided) => ingredientMatches(avoided, nope)),
      );
      conflicts.push({ member, ingredient: hit.name, coveredBy: cover?.label ?? null });
    }
  }
  return conflicts;
}
