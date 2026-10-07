import { describe, expect, it } from "vitest";
import { parseSportsCalendar, readArrival, readPlace, readTitle, zonedTimeToUtc } from "./ics";
import { describeSchedule, eventsOn, placeName } from "./schedule";

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "X-WR-TIMEZONE:America/Chicago",
  "BEGIN:VTIMEZONE",
  "TZID:America/Chicago",
  "BEGIN:DAYLIGHT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:practice-1",
  "DTSTART;TZID=America/Chicago:20261007T174500",
  "DTEND;TZID=America/Chicago:20261007T190000",
  "SUMMARY:Practice U13 GA 26-27 Chicago FC United GA U13 at 5:45PM Central Day",
  " light Time .Uniform: Black practice jersey, black shorts, black socks.",
  "LOCATION:field Turf Field #11: Vernon Hills Athletic Complex\\, 300 Nike Pkwy Vernon Hills\\, IL",
  "STATUS:CONFIRMED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:game-1",
  "DTSTART;TZID=America/Chicago:20261010T140000",
  "DTEND;TZID=America/Chicago:20261010T160000",
  "SUMMARY:GA vs MI Jags U13 GA 26-27 Chicago FC United GA U13 at 2:00PM Central Daylight Time .Uniform: White jersey. Arrival: 40 mins before kickoff.",
  "LOCATION:field 12: Vernon Hills Athletic Complex, 300 Nike Pkwy Vernon Hills, IL",
  "STATUS:CONFIRMED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled-1",
  "DTSTART;TZID=America/Chicago:20261007T201500",
  "DTEND;TZID=America/Chicago:20261007T213000",
  "SUMMARY:CANCELLED: Practice U13 GA at 8:15PM Central Daylight Time",
  "LOCATION:North Shore Sportscenter, 1900 Old Willow Rd Northbrook, IL",
  "STATUS:CONFIRMED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:utc-1",
  "DTSTART:20261008T003000Z",
  "SUMMARY:Team dinner",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("reading a team calendar", () => {
  const events = parseSportsCalendar(FEED, "America/Chicago");

  it("reads every event, and only events", () => {
    // In time order: 5:45 PM, 7:30 PM (written in UTC), 8:15 PM, then Saturday's game.
    expect(events.map((e) => e.uid)).toEqual(["practice-1", "utc-1", "cancelled-1", "game-1"]);
  });

  it("gets the time right in the team's time zone", () => {
    // 5:45 PM Central Daylight is 22:45 UTC
    expect(events[0].startUtc).toBe("2026-10-07T22:45:00.000Z");
    expect(events[0].endUtc).toBe("2026-10-08T00:00:00.000Z");
  });

  it("boils the title down and keeps the address without the field number", () => {
    expect(events[0].title).toBe("Practice");
    expect(events[0].place).toBe("Vernon Hills Athletic Complex, 300 Nike Pkwy Vernon Hills, IL");
    expect(events[3].title).toBe("Game vs MI Jags");
    expect(events[3].arriveEarlyMinutes).toBe(40);
  });

  it("knows a practice is cancelled even when the feed still calls it confirmed", () => {
    const cancelled = events.find((e) => e.uid === "cancelled-1")!;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.title).toBe("Practice");
  });
});

describe("titles and places", () => {
  it("reads status words teams put in front", () => {
    expect(readTitle("CHANGED: Practice U13 at 7:00PM")).toMatchObject({ title: "Practice", status: "on", changed: true });
    expect(readTitle("TIME TBA: Optional Winter Futsal League U13 at 4:00PM")).toMatchObject({
      title: "Winter Futsal League",
      status: "tba",
      optional: true,
    });
    expect(readTitle("Age Group Technical Training U13 GA 26-27")).toMatchObject({ title: "Age Group Technical Training" });
    expect(readTitle("Brayden - Practice").title).toBe("Brayden - Practice");
  });

  it("finds arrival times and place names", () => {
    expect(readArrival("Arrival: 40 mins before kickoff")).toBe(40);
    expect(readArrival("Please arrive 30 minutes early")).toBe(30);
    expect(readArrival("Uniform: red")).toBeNull();
    expect(readPlace("court 2: Lake Forest High School, 1285 N McKinley Rd")).toBe("Lake Forest High School, 1285 N McKinley Rd");
    expect(placeName("North Shore Sportscenter, 1900 Old Willow Rd Northbrook, IL")).toBe("North Shore Sportscenter");
    expect(placeName("300 Nike Pkwy, Vernon Hills, IL")).toBe("300 Nike Pkwy, Vernon Hills, IL");
  });

  it("converts wall-clock times across daylight saving", () => {
    // November: Central Standard, UTC-6
    expect(new Date(zonedTimeToUtc({ year: 2026, month: 11, day: 15, hour: 16, minute: 0 }, "America/Chicago")).toISOString()).toBe(
      "2026-11-15T22:00:00.000Z",
    );
  });
});

describe("tonight's schedule", () => {
  const calendars = [{ id: "cal", who: "Alexa", sport: "Soccer", events: parseSportsCalendar(FEED, "America/Chicago") }];

  it("lists the day's events with when to leave and when they're back", () => {
    const tonight = eventsOn(calendars, "2026-10-07", "America/Chicago", (place) => (place.includes("Vernon") ? 21 : 18));
    // The UTC event at 00:30Z on the 8th is 7:30 PM on the 7th in Chicago.
    expect(tonight.map((e) => e.title)).toEqual(["Practice", "Team dinner", "Practice"]);
    const practice = tonight[0];
    expect(practice).toMatchObject({ who: "Alexa", start: 17 * 60 + 45, end: 19 * 60, driveMinutes: 21, placeName: "Vernon Hills Athletic Complex" });
    expect(practice.leaveAt).toBe(17 * 60 + 24);
    expect(practice.backAt).toBe(19 * 60 + 21);
    expect(tonight[2].status).toBe("cancelled");
  });

  it("leaves early enough for an arrival time", () => {
    const [game] = eventsOn(calendars, "2026-10-10", "America/Chicago", () => 21);
    expect(game.arriveBy).toBe(13 * 60 + 20);
    expect(game.leaveAt).toBe(12 * 60 + 59);
    expect(describeSchedule([game])).toContain("be there by 1:20 PM");
  });

  it("does the arithmetic for Claude", () => {
    const [practice] = eventsOn(calendars, "2026-10-07", "America/Chicago", () => 21);
    expect(describeSchedule([practice])).toBe(
      "- Alexa (Soccer): Practice, 5:45 PM–7:00 PM, at Vernon Hills Athletic Complex, 21 min drive each way, leave home 5:24 PM, home again about 7:21 PM",
    );
  });
});
