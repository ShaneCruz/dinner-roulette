import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { labelDiners } = await import("./restaurants");

describe("labelDiners", () => {
  it("describes people anonymously with what matters for ordering", () => {
    const labeled = labelDiners([
      { memberId: "dad", isKid: false, spiceTolerance: 3, nopes: [], prefersHighProtein: true, wantsHealthy: true, favorites: [] },
      { memberId: "teen", isKid: true, spiceTolerance: 1, nopes: ["ground beef"], prefersHighProtein: false, wantsHealthy: false, favorites: ["Taco Night"] },
      { memberId: "tween", isKid: true, spiceTolerance: 0, nopes: [], prefersHighProtein: false, wantsHealthy: false, favorites: [] },
    ]);
    expect(labeled.map((l) => l.label)).toEqual(["Person A", "Person B", "Person C"]);
    expect(labeled[0].description).toBe(
      "Person A: an adult; loves very spicy food; likes high-protein meals; prefers lighter, healthier options",
    );
    expect(labeled[1].description).toContain("never eats ground beef");
    expect(labeled[1].description).toContain("Taco Night");
    expect(labeled[2].description).toContain("no spicy food at all");
    // No member ids or names leak into what Claude sees
    expect(labeled.map((l) => l.description).join(" ")).not.toMatch(/dad|teen|tween/);
  });
});
