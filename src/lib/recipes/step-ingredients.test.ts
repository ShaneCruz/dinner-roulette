import { describe, expect, it } from "vitest";
import type { IngredientInput } from "./schema";
import { ingredientsForStep } from "./step-ingredients";

const i = (name: string): IngredientInput => ({ name, quantity: 1, unit: "whole", section: "produce", perishable: true });
const ingredients = [i("boneless skinless chicken breast"), i("yellow onion"), i("garlic"), i("kosher salt"), i("bell pepper"), i("black pepper")];

describe("ingredients a step mentions", () => {
  it("finds ingredients by name or their key word", () => {
    expect(ingredientsForStep("Season the chicken and slice the onions.", ingredients)).toEqual([0, 1]);
    expect(ingredientsForStep("Add the garlic and a pinch of salt.", ingredients)).toEqual([2, 3]);
  });
  it("doesn't match on vague words alone", () => {
    expect(ingredientsForStep("Serve in a large bowl.", ingredients)).toEqual([]);
  });
  it("matches both peppers when the step says pepper", () => {
    expect(ingredientsForStep("Stir in the peppers.", ingredients)).toEqual([4, 5]);
  });
});
