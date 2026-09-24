import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/suggest/engine";
import { chooserOptions, cleanFavorites, findDish, orderText, restaurantWeight, sameDish, usualOrder, weightedIndex } from "./favorites";

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
  shared: ["Mac and cheese", "Mother Hen", "Mac and Cheese", "  ", { dish: "Mini muffins", qty: "each" }],
});

describe("usual order", () => {
  it("adds up the same dish into one line, plus the table items", () => {
    const order = usualOrder(cluckers, [...kids, ...parents]);
    expect(order.lines).toEqual([
      { dish: "Kids Drumsticks meal with fries", count: 3, who: ["Kaela", "Alexa", "Brayden"] },
    ]);
    expect(order.shared).toEqual([
      { dish: "Mac and cheese", count: 1 },
      { dish: "Mother Hen", count: 1 },
      { dish: "Mini muffins", count: 5 },
    ]);
    expect(order.missing).toEqual(["Shane", "Jamie"]);
    expect(orderText(order, "Cluckers")).toContain("• 3× Kids Drumsticks meal with fries (Kaela, Alexa, Brayden)");
    expect(orderText(order, "Cluckers")).toContain("• 5× Mini muffins (to share)");
    expect(orderText(order, "Cluckers")).toContain("• Mother Hen (to share)");
  });

  it("orders one each per person actually eating", () => {
    expect(usualOrder(cluckers, kids).shared).toContainEqual({ dish: "Mini muffins", count: 3 });
    expect(usualOrder(cluckers, []).shared).not.toContainEqual(expect.objectContaining({ dish: "Mini muffins" }));
  });

  it("keeps a plain name as one, and holds a count steady", () => {
    const saved = cleanFavorites({
      people: {},
      shared: ["Garlic bread", { dish: "Edamame", qty: 2 }, { dish: "Muffin", qty: "each" }],
    });
    expect(saved.shared).toEqual([
      { dish: "Garlic bread", qty: 1 },
      { dish: "Edamame", qty: 2 },
      { dish: "Muffin", qty: "each" },
    ]);
    expect(usualOrder(saved, kids).shared).toEqual([
      { dish: "Garlic bread", count: 1 },
      { dish: "Edamame", count: 2 },
      { dish: "Muffin", count: 3 },
    ]);
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

describe("matching what we call a dish to the menu", () => {
  it("matches renamed and dressed-up menu entries", () => {
    expect(sameDish("Chips and Guac", "Fresh Chips with Mild Salsa & Guacamole")).toBe(true);
    expect(sameDish("Chips and Guac", "Fresh Chips & Guacamole")).toBe(true);
    expect(sameDish("Kids Drum Sticks meal with fries", "Kid's Drumsticks Meal (with fries)")).toBe(true);
    expect(sameDish("mac and cheese", "Homemade Mac & Cheese")).toBe(true);
    expect(sameDish("Grilled Cheese", "Grilled Cheese Sandwich")).toBe(true);
    expect(sameDish("Chicken Burrito Bowl", "chicken burrito bowl")).toBe(true);
  });

  it("keeps a kid's portion separate from the grown-up one", () => {
    expect(sameDish("Kid's Mac and Cheese", "Kids Mac and Cheese")).toBe(true);
    expect(sameDish("Kid's Mac and Cheese", "Kids Mac & Cheese")).toBe(true);
    expect(sameDish("Kid's Mac and Cheese", "Mac and Cheese")).toBe(false);
    expect(sameDish("Mac and Cheese", "Kids Mac and Cheese")).toBe(false);
    expect(sameDish("Kids Sliders", "Junior Sliders")).toBe(true);
    expect(sameDish("Buffalo Wings", "Wings")).toBe(false);
    expect(sameDish("Large Caesar Salad", "Caesar Salad")).toBe(false);
  });

  it("doesn't match different dishes that share a word", () => {
    expect(sameDish("Chicken Burrito Bowl", "Steak Burrito")).toBe(false);
    expect(sameDish("Kids Sliders", "Kids Mac and Cheese")).toBe(false);
    expect(sameDish("Avocado Roll", "Spicy Tuna Roll")).toBe(false);
    // One word apart, and that word is the whole difference.
    expect(sameDish("Red Dragon Roll", "Yellow Dragon Roll")).toBe(false);
    expect(sameDish("Spicy Dragon Roll", "Yellow Dragon Roll")).toBe(false);
    expect(sameDish("Chicken Fried Rice", "Shrimp Fried Rice")).toBe(false);
  });

  // Taken off Clucker's real ordering menu, where the same dish appears as a
  // side, a kids' portion and a catering pan.
  it("handles the names a real menu actually uses", () => {
    expect(sameDish("Mac & Cheese", "Mac N Cheese")).toBe(true);
    expect(sameDish("Mac & Cheese", "Kids Mac+Cheese No Chicken")).toBe(false);
    expect(sameDish("The Mother Hen", "Mother Hen")).toBe(true);
    expect(sameDish("Mini Muffin", "Mini muffins")).toBe(true);
    expect(sameDish("Mini Muffin", "Homemade Cornbread Muffin (1)")).toBe(false);
    expect(sameDish("Kids Drum Sticks", "Kid’s Drumsticks")).toBe(true);
  });

  it("finds the menu entry, exact first", () => {
    const dishes = [{ name: "Chicken Quesadilla" }, { name: "Kid's Quesadilla" }];
    expect(findDish("Kids Quesadilla", dishes)?.name).toBe("Kid's Quesadilla");
    expect(findDish("Chicken Quesadilla", dishes)?.name).toBe("Chicken Quesadilla");
    expect(findDish("Nachos", dishes)).toBeUndefined();
  });

  it("prefers the entry that has a price", () => {
    const dishes = [
      { name: "Kung Pao (Chicken)", price: null },
      { name: "Kung Pao", price: "$12.00+" },
    ];
    expect(findDish("Kung Pao (Chicken)", dishes)?.price).toBe("$12.00+");
    expect(findDish("Kung Pao", dishes)?.price).toBe("$12.00+");
  });
});

describe("what the order costs", () => {
  const dishes = [
    { name: "Kids Mac and Cheese", price: "$8.99" },
    { name: "Joe Burger", price: "$16" },
    { name: "Cheese Curds", price: "$11.50" },
    { name: "Greek Chicken Salad", price: null },
  ];

  it("adds up what the menu prices, times how many", async () => {
    const { orderTotal, priceOf } = await import("./favorites");
    expect(priceOf("$8.99")).toBe(8.99);
    expect(priceOf("mains $14-22")).toBe(14);
    expect(priceOf(null)).toBeNull();
    const order = {
      lines: [
        { dish: "Kid's Mac and Cheese", count: 2, who: ["Alexa", "Brayden"] },
        { dish: "Joe Burger", count: 1, who: ["Shane"] },
        { dish: "Greek Chicken Salad", count: 1, who: ["Jamie"] },
      ],
      shared: [{ dish: "Cheese curds", count: 2 }],
    };
    // 2 x 8.99 + 16 + 2 x 11.50, and the unpriced salad is left out
    expect(orderTotal(order, dishes)).toBeCloseTo(56.98);
    expect(orderTotal({ lines: [], shared: [] }, [])).toBeNull();
  });
});
