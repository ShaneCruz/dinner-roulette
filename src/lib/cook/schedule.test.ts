import { describe, expect, it } from "vitest";
import { clockAt, cookingPlan, startsCookingAt, stepDurations, type Dish } from "./schedule";

const chicken: Dish = {
  id: "main", title: "Cheddar Baked Chicken", slug: "cheddar-baked-chicken", activeMinutes: 20, totalMinutes: 60,
  steps: [
    { text: "Heat the oven to 375°F." },
    { text: "Dip the chicken in the butter, then the cereal crumbs." },
    { text: "Bake until cooked through.", timerMinutes: 35 },
    { text: "Rest 5 minutes, then serve.", timerMinutes: 5 },
  ],
};
const rice: Dish = {
  id: "rice", title: "Steamed Rice", slug: "steamed-rice", activeMinutes: 5, totalMinutes: 25,
  steps: [{ text: "Rinse the rice." }, { text: "Simmer covered.", timerMinutes: 18 }, { text: "Fluff and serve." }],
};
const salad: Dish = {
  id: "salad", title: "Simple Green Salad", slug: "simple-green-salad", activeMinutes: 10, totalMinutes: 10,
  steps: [{ text: "Wash and tear the greens." }, { text: "Toss with dressing." }],
};

describe("one timeline for the whole dinner", () => {
  it("gives every step a length, and makes the dish take as long as it says", () => {
    // 2 hands-on steps share the 20 hands-on minutes; the timers are 35 and 5.
    expect(stepDurations(chicken)).toEqual([10, 10, 35, 5]);
    expect(stepDurations(chicken).reduce((a, b) => a + b, 0)).toBe(chicken.totalMinutes);
  });

  it("adds unlisted time (preheating, resting) to the longest wait", () => {
    const roast: Dish = {
      id: "roast", title: "Pot Roast", slug: "pot-roast", activeMinutes: 20, totalMinutes: 480,
      steps: [{ text: "Brown the beef." }, { text: "Slow cook.", timerMinutes: 420 }, { text: "Shred and serve." }],
    };
    // 10 + 420 + 10 = 440, so the missing 40 minutes go onto the slow cook.
    expect(stepDurations(roast)).toEqual([10, 460, 10]);
    expect(startsCookingAt([roast])).toBe(480);
  });

  it("starts each dish so everything lands at the same time", () => {
    const plan = cookingPlan([chicken, rice, salad]);
    expect(plan[0]).toMatchObject({ dish: "Cheddar Baked Chicken", stepNumber: 1, startsAt: 60 });
    // The salad is 10 minutes of work, so it starts 10 minutes before dinner.
    expect(plan.find((s) => s.dish === "Simple Green Salad")!.startsAt).toBe(10);
    // Rice simmers 18 minutes and takes 25 in total.
    expect(plan.find((s) => s.dish === "Steamed Rice")!.startsAt).toBe(25);
    // Earliest first, and nothing is scheduled after serving.
    expect(plan.map((s) => s.startsAt)).toEqual([...plan.map((s) => s.startsAt)].sort((a, b) => b - a));
    expect(Math.min(...plan.map((s) => s.startsAt))).toBeGreaterThan(0);
  });

  it("says when to start cooking", () => {
    expect(startsCookingAt([chicken, rice, salad])).toBe(60);
    expect(startsCookingAt([salad])).toBe(10);
  });

  it("puts clock times on the steps", () => {
    const serve = 18 * 60 + 30;
    expect(clockAt(serve, 60)).toBe("5:30 PM");
    expect(clockAt(serve, 0)).toBe("6:30 PM");
    expect(clockAt(12 * 60, 13 * 60)).toBe("11:00 PM");
  });
});
