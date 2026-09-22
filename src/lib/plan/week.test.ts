import { describe, expect, it } from "vitest";
import { defaultTimeBudget, fitsBudget, weekDates, weekStartFor } from "./week";

describe("weeks", () => {
  it("finds the Sunday that starts the week", () => {
    // 2026-09-23 is a Wednesday
    expect(weekStartFor("2026-09-23", 0)).toBe("2026-09-20");
    expect(weekStartFor("2026-09-20", 0)).toBe("2026-09-20");
  });

  it("supports weeks that start on Monday", () => {
    expect(weekStartFor("2026-09-20", 1)).toBe("2026-09-14");
  });

  it("lists seven nights", () => {
    const dates = weekDates("2026-09-27");
    expect(dates).toHaveLength(7);
    expect(dates.at(-1)).toBe("2026-10-03");
  });

  it("defaults weekends to more cooking time", () => {
    expect(defaultTimeBudget("2026-09-26")).toBe("weekend"); // Saturday
    expect(defaultTimeBudget("2026-09-23")).toBe("normal");
  });
});

describe("fitsBudget", () => {
  const quick = { activeMinutes: 15, totalMinutes: 20 };
  const potRoast = { activeMinutes: 20, totalMinutes: 480 };
  const lasagna = { activeMinutes: 45, totalMinutes: 90 };

  it("respects hands-on time", () => {
    expect(fitsBudget(quick, "quick", 30)).toBe(true);
    expect(fitsBudget(lasagna, "normal", 30)).toBe(false);
    expect(fitsBudget(lasagna, "weekend", 30)).toBe(true);
  });

  it("allows slow cooker meals only when they can simmer unattended", () => {
    expect(fitsBudget(potRoast, "hands_off", 30)).toBe(true);
    expect(fitsBudget(potRoast, "normal", 30)).toBe(false);
  });
});
