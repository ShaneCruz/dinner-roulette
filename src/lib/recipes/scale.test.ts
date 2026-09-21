import { describe, expect, it } from "vitest";
import { formatAmount, formatQuantity, scaleAmount } from "./scale";

describe("scaleAmount", () => {
  it("leaves to-taste amounts alone", () => {
    expect(scaleAmount({ quantity: null, unit: "to_taste" }, 3)).toEqual({
      quantity: null,
      unit: "to_taste",
    });
  });

  it("promotes teaspoons to tablespoons", () => {
    expect(scaleAmount({ quantity: 1, unit: "tsp" }, 3)).toEqual({ quantity: 1, unit: "tbsp" });
  });

  it("promotes tablespoons to cups", () => {
    expect(scaleAmount({ quantity: 4, unit: "tbsp" }, 2)).toEqual({ quantity: 0.5, unit: "cup" });
  });

  it("prefers thirds of a cup when closer", () => {
    expect(scaleAmount({ quantity: 1, unit: "cup" }, 2 / 3)).toEqual({
      quantity: 2 / 3,
      unit: "cup",
    });
  });

  it("demotes cups to tablespoons when scaled down", () => {
    expect(scaleAmount({ quantity: 0.25, unit: "cup" }, 0.5)).toEqual({
      quantity: 2,
      unit: "tbsp",
    });
  });

  it("turns ounces into pounds", () => {
    expect(scaleAmount({ quantity: 12, unit: "oz" }, 2)).toEqual({ quantity: 1.5, unit: "lb" });
  });

  it("rounds countable items to halves", () => {
    expect(scaleAmount({ quantity: 1, unit: "whole" }, 1.3)).toEqual({
      quantity: 1.5,
      unit: "whole",
    });
    expect(scaleAmount({ quantity: 1, unit: "whole" }, 0.2)).toEqual({
      quantity: 0.5,
      unit: "whole",
    });
  });
});

describe("formatting", () => {
  it("uses kitchen fractions", () => {
    expect(formatQuantity(1.5)).toBe("1½");
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(2)).toBe("2");
  });

  it("pluralizes units", () => {
    expect(formatAmount({ quantity: 2, unit: "cup" })).toBe("2 cups");
    expect(formatAmount({ quantity: 0.5, unit: "cup" })).toBe("½ cup");
    expect(formatAmount({ quantity: 3, unit: "clove" })).toBe("3 cloves");
    expect(formatAmount({ quantity: 2, unit: "whole" })).toBe("2");
    expect(formatAmount({ quantity: null, unit: "to_taste" })).toBe("to taste");
  });
});
