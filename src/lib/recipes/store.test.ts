import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { STARTER_RECIPES } from "@/data/starter-recipes";
import { createTestDatabase } from "@/test/db";
import { seedStarterRecipes } from "./seed";
import { getRecipe, listRecipes, saveRecipe, setRecipeArchived, slugify, uniqueSlug } from "./store";

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
});

describe("recipe store", () => {
  it("seeds starter recipes once", async () => {
    const first = await seedStarterRecipes(db);
    expect(first).toBe(STARTER_RECIPES.length);
    expect(await seedStarterRecipes(db)).toBe(0);
  });

  it("round-trips a recipe with ingredients and variants", async () => {
    const original = STARTER_RECIPES.find((r) => r.slug === "taco-night")!;
    const stored = await getRecipe(db, { slug: "taco-night" });
    expect(stored).not.toBeNull();
    expect(stored!.ingredients).toHaveLength(original.ingredients.length);
    expect(stored!.ingredients[0].name).toBe(original.ingredients[0].name);
    expect(stored!.variants.map((v) => v.kind)).toEqual(
      (original.variants ?? []).map((v) => v.kind),
    );
  });

  it("updates in place, replacing ingredients", async () => {
    const stored = (await getRecipe(db, { slug: "steamed-rice" }))!;
    await saveRecipe(
      db,
      { ...stored, title: "Fluffy Rice", ingredients: stored.ingredients.slice(0, 1) },
      { source: "manual" },
      stored.id,
    );
    const updated = (await getRecipe(db, { id: stored.id }))!;
    expect(updated.title).toBe("Fluffy Rice");
    expect(updated.ingredients).toHaveLength(1);
  });

  it("searches by title and ingredient, and hides archived recipes", async () => {
    const titles = STARTER_RECIPES.map((r) => r.title.toLowerCase()).join(" ");
    const ingredientOnly = STARTER_RECIPES.flatMap((r) => r.ingredients).find(
      (i) => !titles.includes(i.name),
    )!;
    const byIngredient = await listRecipes(db, { search: ingredientOnly.name });
    expect(byIngredient.length).toBeGreaterThan(0);

    const souvlaki = (await getRecipe(db, { slug: "chicken-souvlaki" }))!;
    await setRecipeArchived(db, souvlaki.id, true);
    const visible = await listRecipes(db, { search: "souvlaki" });
    expect(visible).toHaveLength(0);
    // Archived starters are not re-added by a later seed
    expect(await seedStarterRecipes(db)).toBe(0);
  });

  it("makes unique slugs", async () => {
    expect(slugify("Mom's Famous Chili!")).toBe("mom-s-famous-chili");
    expect(await uniqueSlug(db, "taco-night")).toBe("taco-night-2");
    expect(await uniqueSlug(db, "brand-new-dish")).toBe("brand-new-dish");
  });
});
