import { describe, expect, it } from "vitest";
import { findSimilar } from "./similar";

const box = [
  "Baked Chicken Tenders with Honey Mustard",
  "Chicken Noodle Soup",
  "Chicken Parmesan Sandwiches",
  "Chicken Quesadillas",
  "Chicken Souvlaki",
  "Lemon Garlic Grilled Chicken",
  "Grilled Steak",
  "Slow Cooker Pot Roast",
  "Taco Night",
  "Spaghetti Bolognese",
  "Mashed Potatoes",
  "Baked Potatoes",
].map((title, i) => ({ id: `r${i}`, title }));

const titles = (t: string) => findSimilar(t, box).map((r) => r.title);

describe("finding duplicate recipes", () => {
  it("doesn't flag every chicken dinner as the same dish", () => {
    expect(titles("Mom's Chicken Pot Pie")).toEqual([]);
  });

  it("finds the real duplicate", () => {
    expect(titles("Chicken Noodle Soup")).toEqual(["Chicken Noodle Soup"]);
    expect(titles("Easy Chicken Quesadillas")).toEqual(["Chicken Quesadillas"]);
    expect(titles("Grandma's Slow Cooker Pot Roast")).toEqual(["Slow Cooker Pot Roast"]);
  });

  it("doesn't confuse pot roast with pot pie", () => {
    expect(titles("Chicken Pot Pie")).not.toContain("Slow Cooker Pot Roast");
  });

  it("suggests the other potato sides, and only those", () => {
    const found = titles("Twice-Baked Potatoes");
    expect(found).toContain("Baked Potatoes");
    expect(found.length).toBeLessThanOrEqual(2);
  });

  it("still catches the same dish under another name", () => {
    expect(titles("Sheet Pan Crispy Baked Beef Tacos")).toEqual(["Taco Night"]);
    expect(titles("Taco Night with Ground Beef")).toEqual(["Taco Night"]);
    expect(titles("Spaghetti Bolognese (Mom's)")).toEqual(["Spaghetti Bolognese"]);
  });

  it("shows at most three", () => {
    expect(findSimilar("Chicken Chicken Chicken Soup Noodle Parmesan Quesadilla Souvlaki", box).length).toBeLessThanOrEqual(3);
  });
});
