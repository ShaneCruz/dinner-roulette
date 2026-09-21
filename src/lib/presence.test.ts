import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateRange,
  presenceOn,
  rangesNeedingConfirmation,
  todayIn,
  upcomingExceptions,
  upcomingHomecomings,
  type PresenceMember,
  type PresenceRange,
} from "./presence";

const boarder: PresenceMember = { id: "k", name: "Kid", defaultPresence: "away" };
const parent: PresenceMember = { id: "p", name: "Parent", defaultPresence: "home" };

const range = (overrides: Partial<PresenceRange>): PresenceRange => ({
  id: Math.random().toString(36),
  memberId: "k",
  startDate: "2026-11-21",
  endDate: "2026-11-30",
  presence: "home",
  label: "Fall vacation",
  tentative: false,
  ...overrides,
});

describe("date helpers", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-14", "2026-11-21")).toBe(7);
  });

  it("reads today in the family's timezone", () => {
    // 3am UTC on Sep 22 is still Sep 21 in Chicago
    expect(todayIn("America/Chicago", new Date("2026-09-22T03:00:00Z"))).toBe("2026-09-21");
  });

  it("formats ranges compactly", () => {
    expect(formatDateRange("2026-11-21", "2026-11-30")).toBe("Nov 21 – 30");
    expect(formatDateRange("2026-12-18", "2027-01-03")).toBe("Dec 18 – Jan 3");
  });
});

describe("presenceOn", () => {
  const breakRange = range({});

  it("uses the default outside any range", () => {
    expect(presenceOn(boarder, [breakRange], "2026-11-20").presence).toBe("away");
  });

  it("applies a confirmed range, inclusive of both ends", () => {
    expect(presenceOn(boarder, [breakRange], "2026-11-21").presence).toBe("home");
    expect(presenceOn(boarder, [breakRange], "2026-11-30").presence).toBe("home");
  });

  it("lets a shorter range win inside a longer one", () => {
    const sleepover = range({ startDate: "2026-11-25", endDate: "2026-11-25", presence: "away" });
    expect(presenceOn(boarder, [breakRange, sleepover], "2026-11-25").presence).toBe("away");
    expect(presenceOn(boarder, [breakRange, sleepover], "2026-11-26").presence).toBe("home");
  });

  it("ignores tentative ranges but reports them", () => {
    const maybe = range({ tentative: true });
    const result = presenceOn(boarder, [maybe], "2026-11-22");
    expect(result.presence).toBe("away");
    expect(result.unconfirmed?.id).toBe(maybe.id);
  });
});

describe("banners and alerts", () => {
  const breakRange = range({});

  it("announces a homecoming within a week", () => {
    const [homecoming] = upcomingHomecomings([boarder, parent], [breakRange], "2026-11-18");
    expect(homecoming.daysUntil).toBe(3);
    expect(upcomingHomecomings([boarder], [breakRange], "2026-11-10")).toHaveLength(0);
  });

  it("asks parents to confirm tentative ranges", () => {
    const maybe = range({ tentative: true });
    expect(rangesNeedingConfirmation([maybe], "2026-11-12")).toHaveLength(1);
    expect(rangesNeedingConfirmation([maybe], "2026-11-01")).toHaveLength(0);
  });

  it("flags a parent's trip", () => {
    const trip = range({
      memberId: "p",
      startDate: "2026-10-16",
      endDate: "2026-10-19",
      presence: "away",
      label: "Visiting Andover",
    });
    const exceptions = upcomingExceptions([boarder, parent], [trip], "2026-10-10");
    expect(exceptions.map((e) => e.member.name)).toEqual(["Parent"]);
  });
});
