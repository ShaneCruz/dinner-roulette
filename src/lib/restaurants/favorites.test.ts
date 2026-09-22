import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/suggest/engine";
import { chooserOptions, cleanFavorites, orderText, restaurantWeight, usualOrder, weightedIndex } from "./favorites";

const kids = [
  { id: "k1", name: "Kaela" },
  { id: "k2", name: "Alexa" },
  { id: "k3", name: "Brayden" },
];
const parents = [
  { id: "p1", name: "Shane" },
  { id: "p2", name: "Jamie" },
];

const cluckers = cleanFavorites({
  people: {
    k1: { dishes: ["Kids Drumsticks meal with fries"], feeling: "love" },
    k2: { dishes: ["kids drumsticks meal with fries "], feeling: null },
    k3: { dishes: ["Kids Drumsticks meal with fries", "Kids Tenders"], feeling: null },
    p2: { dishes: [], feeling: "meh" },
  },
  shared: ["Mac and cheese", "Mother Hen", "Mac and Cheese", "  "],
});

describe("usual order", () => {
  it("adds up the same dish into one line, plus the table items", () => {
    const order = usualOrder(cluckers, [...kids, ...parents]);
    expect(order.lines).toEqual([
      { dish: "Kids Drumsticks meal with fries", count: 3, who: ["Kaela", "Alexa", "Brayden"] },
    ]);
    expect(order.shared).toEqual(["Mac and cheese", "Mother Hen"]);
    expect(order.missing).toEqual(["Shane", "Jamie"]);
    expect(orderText(order, "Cluckers")).toContain("• 3× Kids Drumsticks meal with fries (Kaela, Alexa, Brayden)");
  });

  it("uses tonight's choice over the usual", () => {
    const order = usualOrder(cluckers, kids, { k3: "Kids Tenders" });
    expect(order.lines.map((l) => [l.dish, l.count])).toEqual([
      ["Kids Drumsticks meal with fries", 2],
      ["Kids Tenders", 1],
    ]);
  });

  it("drops empty entries but keeps a feeling on its own", () => {
    expect(cluckers.people.p2).toEqual({ dishes: [], feeling: "meh" });
    expect(cleanFavorites({ people: { x: { dishes: [" "], feeling: null } }, shared: [] }).people).toEqual({});
  });
});

describe("help me choose", () => {
  const research = {
    picks: [{ memberId: "k1", dish: "Grilled Cheese", why: "" }],
    dishes: [
      { name: "Buffalo Wings", description: null, price: null, tags: ["spicy"] },
      { name: "Kids Sliders", description: null, price: null, tags: ["kid_friendly"] },
      { name: "Nachos", description: null, price: null, tags: ["shareable"] },
      { name: "Steak Salad", description: null, price: null, tags: ["high_protein", "lighter"] },
    ],
  };
  const kid = { isKid: true, spiceTolerance: 1, prefersHighProtein: false, wantsHealthy: false };

  it("puts favorites first, then the menu pick, then dishes that suit them", () => {
    const options = chooserOptions("k1", cleanFavorites({ people: { k1: { dishes: ["Mac and cheese"], feeling: null } }, shared: [] }), research, kid);
    expect(options.slice(0, 3)).toEqual(["Mac and cheese", "Grilled Cheese", "Kids Sliders"]);
    expect(options).not.toContain("Buffalo Wings");
  });

  it("suggests protein for someone who wants it", () => {
    const options = chooserOptions("p1", null, research, { isKid: false, spiceTolerance: 3, prefersHighProtein: true, wantsHealthy: true });
    expect(options[0]).toBe("Steak Salad");
    expect(options).toContain("Buffalo Wings");
  });
});

describe("the takeout wheel", () => {
  it("leans toward places people love and away from ones they don't", () => {
    expect(restaurantWeight(null, ["k1"])).toBe(1);
    expect(restaurantWeight(cluckers, ["k1", "k2"])).toBe(1.5);
    expect(restaurantWeight(cluckers, ["p2"])).toBeCloseTo(0.65);
    const random = seededRandom(4);
    const counts = [0, 0];
    for (let i = 0; i < 5000; i++) counts[weightedIndex([3, 1], random)]++;
    expect(counts[0] / 5000).toBeGreaterThan(0.7);
    expect(counts[0] / 5000).toBeLessThan(0.8);
  });
});
