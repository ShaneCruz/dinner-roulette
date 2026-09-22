import type { IngredientInput, Recipe, VariantInput } from "./schema";

// Starting values for the recipe editor. Kept out of the "use client" form
// module so server pages can call them too.

export const emptyIngredient = (): IngredientInput => ({
  name: "",
  quantity: 1,
  unit: "whole",
  section: "produce",
  perishable: true,
});

export const emptyVariant = (): VariantInput => ({
  kind: "healthy",
  label: "",
  description: "",
  removes: [],
  adds: [],
  extraSteps: [],
  extraActiveMinutes: 0,
  avoids: [],
});

export const blankRecipe = (): Recipe => ({
  slug: "new-recipe",
  title: "",
  description: "",
  kind: "main",
  cuisine: "American",
  tags: [],
  method: "stovetop",
  activeMinutes: 20,
  totalMinutes: 30,
  baseServings: 5,
  spiceLevel: 0,
  spiceSplit: null,
  seasonFit: "any",
  indoorMethod: null,
  healthCategory: "balanced",
  cooldownDays: null,
  ingredients: [emptyIngredient()],
  steps: [{ text: "" }],
  variants: [],
  pairsWith: [],
});
