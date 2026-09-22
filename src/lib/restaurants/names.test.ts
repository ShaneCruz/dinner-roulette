import { describe, expect, it } from "vitest";
import { withNames } from "./names";

describe("withNames", () => {
  const labels = { "Person A": "m1", "Person B": "m2" };
  const names = new Map([
    ["m1", "Shane"],
    ["m2", "Alexa"],
  ]);

  it("swaps labels for names", () => {
    expect(withNames("A large for Person A and a mild slice for Person B.", labels, names)).toBe(
      "A large for Shane and a mild slice for Alexa.",
    );
  });

  it("leaves unknown labels and empty text alone", () => {
    expect(withNames("Person Z gets fries", labels, names)).toBe("Person Z gets fries");
    expect(withNames(null, labels, names)).toBeNull();
    expect(withNames("no labels here", undefined, names)).toBe("no labels here");
  });
});
