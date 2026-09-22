import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDERS } from "@/db/schema";
import { clockLabel, dueReminders, minutesIn, parseClock, type ReminderMeal } from "./reminders";

const meal = (over: Partial<ReminderMeal> = {}): ReminderMeal => ({
  id: "m1", date: "2026-10-12", status: "planned", title: "Pot Roast", slug: "pot-roast", totalMinutes: 480,
  proteins: ["chuck roast"], eaterIds: ["a", "b"], ratedIds: [], ...over,
});
const base = { prefs: DEFAULT_REMINDERS, dinnerTime: "18:00", today: null, tomorrow: null };

describe("reminders", () => {
  it("says when to start a long recipe, but only in its window", () => {
    // 8 hours + 10 minutes before 6 PM = 9:50 AM
    expect(dueReminders({ ...base, nowMinutes: parseClock("09:49"), today: meal() })).toEqual([]);
    const [start] = dueReminders({ ...base, nowMinutes: parseClock("09:55"), today: meal() });
    expect(start).toMatchObject({ key: "start:2026-10-12", to: "parents", url: "/cook/pot-roast" });
    expect(start.body).toContain("about 8 hours");
    expect(dueReminders({ ...base, nowMinutes: parseClock("11:00"), today: meal() })).toEqual([]);
  });

  it("never nags before 7 AM for an all-day recipe", () => {
    const today = meal({ totalMinutes: 720 });
    expect(dueReminders({ ...base, nowMinutes: parseClock("05:30"), today })).toEqual([]);
    expect(dueReminders({ ...base, nowMinutes: parseClock("07:05"), today })[0].key).toBe("start:2026-10-12");
  });

  it("reminds about thawing the night before", () => {
    const [thaw] = dueReminders({ ...base, nowMinutes: parseClock("20:15"), tomorrow: meal({ date: "2026-10-13", proteins: ["chicken thigh", "bacon"] }) });
    expect(thaw.key).toBe("thaw:2026-10-13");
    expect(thaw.body).toContain("chicken thigh and bacon are frozen");
    expect(thaw.body).toContain("start it early");
    expect(dueReminders({ ...base, nowMinutes: parseClock("20:15"), tomorrow: meal({ proteins: [] }) })).toEqual([]);
  });

  it("asks the people who ate to rate, or the parents whether they made it", () => {
    const cooked = meal({ status: "cooked", ratedIds: ["a"] });
    const [rate] = dueReminders({ ...base, nowMinutes: parseClock("19:45"), today: cooked });
    expect(rate).toMatchObject({ to: ["b"], url: "/rate/m1" });
    expect(dueReminders({ ...base, nowMinutes: parseClock("19:45"), today: meal({ status: "cooked", ratedIds: ["a", "b"] }) })).toEqual([]);
    expect(dueReminders({ ...base, nowMinutes: parseClock("19:45"), today: meal({ totalMinutes: 30 }) })[0]).toMatchObject({ to: "parents", url: "/" });
  });

  it("respects the family's choices", () => {
    const prefs = { ...DEFAULT_REMINDERS, start: false, rate: false };
    expect(dueReminders({ ...base, prefs, nowMinutes: parseClock("09:55"), today: meal() })).toEqual([]);
  });

  it("reads clocks and time zones", () => {
    expect(clockLabel(parseClock("18:30"))).toBe("6:30 PM");
    expect(minutesIn("America/Chicago", new Date("2026-10-12T23:05:00Z"))).toBe(18 * 60 + 5);
  });
});
