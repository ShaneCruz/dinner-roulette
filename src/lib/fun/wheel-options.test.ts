import { describe, expect, it } from "vitest";
import { seededRandom, type Scored } from "@/lib/suggest/engine";
import { dealWheel } from "./wheel-options";

const ranked: Scored[] = Array.from({ length: 20 }, (_, i) => ({
  recipeId: `r${i}`,
  score: 5 - i * 0.25,
  reasons: [],
  excluded: i === 3 ? "Too spicy" : null,
}));
const cooked = new Map(ranked.map((r, i) => [r.recipeId, i === 12 ? null : "2026-09-01"]));

describe("dealing the dinner wheel", () => {
  it("always keeps the top fits and never deals an excluded dinner", () => {
    for (let seed = 1; seed < 40; seed++) {
      const deal = dealWheel(ranked, cooked, "2026-09-22", seededRandom(seed));
      expect(deal).toHaveLength(6);
      expect(new Set(deal).size).toBe(6);
      expect(deal).toContain("r0");
      expect(deal).toContain("r1");
      expect(deal).not.toContain("r3");
      // The one dinner never made gets a slot
      expect(deal).toContain("r12");
    }
  });

  it("changes between shuffles instead of showing the same six", () => {
    const deals = new Set(Array.from({ length: 10 }, (_, seed) => dealWheel(ranked, cooked, "2026-09-22", seededRandom(seed + 1)).sort().join()));
    expect(deals.size).toBeGreaterThan(3);
  });

  it("uses whatever fits when there are only a few", () => {
    const few = ranked.slice(0, 5);
    expect(dealWheel(few, cooked, "2026-09-22", seededRandom(1)).sort()).toEqual(["r0", "r1", "r2", "r4"]);
  });

  it("gives a slot to something not had in a long time when nothing is brand new", () => {
    const old = new Map(ranked.map((r, i) => [r.recipeId, i === 15 ? "2026-05-01" : "2026-09-10"]));
    for (let seed = 1; seed < 10; seed++) expect(dealWheel(ranked, old, "2026-09-22", seededRandom(seed))).toContain("r15");
  });
});
