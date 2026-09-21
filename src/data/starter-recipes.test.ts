import { describe, expect, it } from "vitest";
import { recipeInputSchema } from "@/lib/recipes/schema";
import { STARTER_RECIPES } from "./starter-recipes";

describe("starter recipes", () => {
  it("all validate", () => {
    for (const recipe of STARTER_RECIPES) {
      const result = recipeInputSchema.safeParse(recipe);
      expect(result.success, `${recipe.slug}: ${result.error?.message}`).toBe(true);
    }
  });

  it("have unique slugs", () => {
    const slugs = STARTER_RECIPES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only remove ingredients that exist", () => {
    for (const recipe of STARTER_RECIPES) {
      const names = new Set(recipe.ingredients.map((i) => i.name));
      for (const variant of recipe.variants ?? []) {
        for (const removed of variant.removes ?? []) {
          expect(names.has(removed), `${recipe.slug} / ${variant.label}: ${removed}`).toBe(true);
        }
      }
    }
  });

  it("pair mains with sides that exist", () => {
    const sides = new Set(STARTER_RECIPES.filter((r) => r.kind === "side").map((r) => r.slug));
    for (const recipe of STARTER_RECIPES) {
      for (const slug of recipe.pairsWith ?? []) {
        expect(sides.has(slug), `${recipe.slug} pairs with ${slug}`).toBe(true);
      }
    }
  });

  it("keep weeknight-friendly mains within 30 active minutes", () => {
    const tooLong = STARTER_RECIPES.filter(
      (r) => r.kind === "main" && r.activeMinutes > 30 && !r.tags?.includes("make_ahead"),
    ).map((r) => `${r.slug} (${r.activeMinutes} min)`);
    // Weekend-only recipes are allowed, but they should be the exception.
    expect(tooLong.length).toBeLessThanOrEqual(3);
  });
});
