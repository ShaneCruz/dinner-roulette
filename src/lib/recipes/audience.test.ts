import { describe, expect, it } from "vitest";
import { heatSeekers, nopeConflicts, variantAudience, type AudienceMember } from "./audience";
import type { Recipe, VariantInput } from "./schema";

const person = (overrides: Partial<AudienceMember>): AudienceMember => ({
  id: overrides.name ?? "x",
  name: "x",
  spiceTolerance: 1,
  prefersHighProtein: false,
  wantsHealthySwaps: false,
  nopes: [],
  ...overrides,
});

const dad = person({ name: "Dad", spiceTolerance: 3, prefersHighProtein: true, wantsHealthySwaps: true });
const mom = person({ name: "Mom", spiceTolerance: 1, wantsHealthySwaps: true });
const teen = person({ name: "Teen", spiceTolerance: 1, nopes: ["ground beef"] });
const tween = person({ name: "Tween", spiceTolerance: 0 });
const family = [dad, mom, teen, tween];

const variant = (overrides: Partial<VariantInput>): VariantInput => ({
  kind: "healthy",
  label: "v",
  description: "d",
  removes: [],
  adds: [],
  extraSteps: [],
  extraActiveMinutes: 0,
  avoids: [],
  ...overrides,
});

const tacos = {
  spiceLevel: 1,
  ingredients: [
    { name: "ground beef", quantity: 2, unit: "lb", section: "meat", perishable: true },
    { name: "hot sauce", quantity: null, unit: "to_taste", section: "pantry", perishable: false, optional: true },
  ],
  variants: [variant({ kind: "protein_swap", label: "Chicken tacos", avoids: ["ground beef"] })],
} as Pick<Recipe, "spiceLevel" | "ingredients" | "variants">;

const names = (members: AudienceMember[]) => members.map((m) => m.name);

describe("variantAudience", () => {
  it("offers healthy swaps to people who want them", () => {
    expect(names(variantAudience(tacos, variant({ kind: "healthy" }), family))).toEqual(["Dad", "Mom"]);
  });

  it("offers protein boosts to protein lovers", () => {
    expect(names(variantAudience(tacos, variant({ kind: "protein_boost" }), family))).toEqual(["Dad"]);
  });

  it("offers mild versions to anyone below the recipe's heat", () => {
    expect(names(variantAudience({ spiceLevel: 2 }, variant({ kind: "mild" }), family))).toEqual([
      "Mom",
      "Teen",
      "Tween",
    ]);
  });

  it("matches protein swaps to hard nopes", () => {
    expect(names(variantAudience(tacos, tacos.variants[0], family))).toEqual(["Teen"]);
  });
});

describe("nopeConflicts", () => {
  it("reports nopes and the variant that covers them", () => {
    expect(nopeConflicts(tacos, family)).toEqual([
      { member: teen, ingredient: "ground beef", coveredBy: "Chicken tacos" },
    ]);
  });

  it("ignores optional ingredients", () => {
    const hater = person({ name: "Hater", nopes: ["hot sauce"] });
    expect(nopeConflicts(tacos, [hater])).toEqual([]);
  });
});

it("finds heat seekers", () => {
  expect(names(heatSeekers(family))).toEqual(["Dad"]);
});
