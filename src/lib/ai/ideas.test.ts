import { describe, expect, it } from "vitest";
import { dishWords, matchScore, pickRecipeUrls } from "./ideas";

describe("pickRecipeUrls", () => {
  const searched = [
    "https://www.budgetbytes.com/one-pot-chicken-fajita-pasta/",
    "https://www.simplyrecipes.com/recipes/chicken_fajitas/",
    "https://www.delish.com/cooking/recipe-ideas/g1234/best-fajita-recipes/",
    "https://www.youtube.com/watch?v=abc",
    "https://www.tasteofhome.com/recipes/sheet-pan-chicken-fajitas/",
  ];

  it("keeps Claude's order, but only for pages the search really returned", () => {
    const text = [
      "https://www.tasteofhome.com/recipes/sheet-pan-chicken-fajitas",
      "https://www.madeup-site.com/recipe/fajitas/",
      "https://www.budgetbytes.com/one-pot-chicken-fajita-pasta/.",
    ].join("\n");
    expect(pickRecipeUrls(text, searched)).toEqual([
      "https://www.tasteofhome.com/recipes/sheet-pan-chicken-fajitas/",
      "https://www.budgetbytes.com/one-pot-chicken-fajita-pasta/",
      // Then other search results that look like a single recipe (not the "best fajita recipes" roundup)
      "https://www.simplyrecipes.com/recipes/chicken_fajitas/",
    ]);
  });

  it("skips videos and social sites even when named", () => {
    expect(pickRecipeUrls("https://www.youtube.com/watch?v=abc", searched)).not.toContain("https://www.youtube.com/watch?v=abc");
  });

  it("falls back to recipe-looking search results when Claude names none", () => {
    expect(pickRecipeUrls("Sorry, here's what I found.", searched, 2)).toEqual([
      "https://www.simplyrecipes.com/recipes/chicken_fajitas/",
      "https://www.tasteofhome.com/recipes/sheet-pan-chicken-fajitas/",
    ]);
  });
});

describe("matching a page to the idea", () => {
  it("uses the words that describe the dish", () => {
    expect(dishWords("Ham, Potato & Egg Sheet Pan Breakfast Bake")).toEqual(["ham", "potato", "egg", "sheet", "pan", "breakfast", "bake"]);
  });

  it("prefers the page with the idea's ingredients", () => {
    const idea = "Ham, Potato & Egg Sheet Pan Breakfast Bake";
    const sausage = '{"name":"Sheet Pan Eggs with Crispy Potatoes and Sausage","recipeIngredient":["eggs","potatoes","sausage"]}';
    const ham = '{"name":"Ham and Potato Breakfast Bake","recipeIngredient":["diced ham","potatoes","eggs","cheddar"],"recipeInstructions":"Spread on a sheet pan and bake"}';
    expect(matchScore(idea, ham)).toBeGreaterThan(matchScore(idea, sausage));
    expect(matchScore(idea, ham)).toBe(1);
  });
});
