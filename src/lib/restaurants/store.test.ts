import { describe, expect, it } from "vitest";
import type { RestaurantResearch } from "@/db/schema";
import { isResearchRunning, menuFromFamily } from "./store";

describe("menu lookups in the background", () => {
  const now = new Date("2026-09-23T18:00:00Z");
  it("counts a lookup as running until it's clearly dead", () => {
    expect(isResearchRunning({ researchStartedAt: new Date("2026-09-23T17:58:00Z") }, now)).toBe(true);
    expect(isResearchRunning({ researchStartedAt: new Date("2026-09-23T17:50:00Z") }, now)).toBe(false);
    expect(isResearchRunning({ researchStartedAt: null }, now)).toBe(false);
  });
});

describe("a menu the family gives us", () => {
  const menu = (names: string[], from?: "search" | "family"): RestaurantResearch => ({
    summary: "",
    menuUrl: null,
    priceRange: null,
    orderingTips: null,
    dishes: names.map((name) => ({ name, description: null, price: null, tags: [] })),
    picks: [],
    familyOrder: null,
    sources: [],
    ...(from ? { menuFrom: from } : {}),
  });
  const names = (research: RestaurantResearch) => research.dishes.map((d) => d.name);

  it("throws away what a search guessed", () => {
    const guessed = menu(["Cheesy Chicken Mac & Cheese", "Milk Chocolate Chicken"], "search");
    expect(names(menuFromFamily(guessed, menu(["Mac & Cheese"])))).toEqual(["Mac & Cheese"]);
    // Menus saved before we tracked where they came from are guesses too.
    expect(names(menuFromFamily(menu(["Sushi Selection"]), menu(["Spider Roll"])))).toEqual(["Spider Roll"]);
    expect(names(menuFromFamily(null, menu(["Edamame"])))).toEqual(["Edamame"]);
  });

  it("adds a second tab to the one they already gave us", () => {
    const dinner = menuFromFamily(null, menu(["Cottage Pie", "Burger"]));
    const both = menuFromFamily(dinner, menu(["Spider Roll", "Burger"]));
    expect(names(both)).toEqual(["Spider Roll", "Burger", "Cottage Pie"]);
    expect(both.menuFrom).toBe("family");
  });
});
