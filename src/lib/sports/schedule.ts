import type { SportEvent } from "@/db/schema";
import { clockLabel } from "@/lib/reminders";

/** One of tonight's practices or games, with the driving worked out. */
export type TonightEvent = {
  /** Calendar id + event uid, so a parent can leave one out */
  key: string;
  who: string;
  /** The calendar's name, e.g. "Soccer" */
  sport: string;
  title: string;
  allDay: boolean;
  /** Minutes after midnight, in the family's time zone */
  start: number | null;
  end: number | null;
  status: SportEvent["status"];
  changed: boolean;
  optional: boolean;
  /** When to be there, if earlier than the start */
  arriveBy: number | null;
  place: string | null;
  /** "Vernon Hills Athletic Complex" */
  placeName: string | null;
  driveMinutes: number | null;
  /** When to leave home, and when they're back, if the drive is known */
  leaveAt: number | null;
  backAt: number | null;
};

export type CalendarEvents = { id: string; who: string; sport: string; events: SportEvent[] };

/** Local date and minutes-after-midnight of an instant in a time zone. */
function localClock(iso: string, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** "North Shore Sportscenter, 1900 Old Willow Rd Northbrook, IL" → "North Shore Sportscenter" */
export function placeName(place: string | null): string | null {
  if (!place) return null;
  const first = place.split(",")[0].trim();
  // A bare street address has no name; show it whole.
  return /^\d/.test(first) ? place : first;
}

/** Everyone's practices and games on a date, earliest first. */
export function eventsOn(
  calendars: CalendarEvents[],
  date: string,
  timeZone: string,
  driveMinutes: (place: string) => number | null,
): TonightEvent[] {
  const out: TonightEvent[] = [];
  for (const calendar of calendars) {
    for (const event of calendar.events) {
      const start = event.startUtc ? localClock(event.startUtc, timeZone) : null;
      if (start ? start.date !== date : event.allDayDate !== date) continue;
      const end = event.endUtc ? localClock(event.endUtc, timeZone) : null;
      const arriveBy = start && event.arriveEarlyMinutes ? start.minutes - event.arriveEarlyMinutes : null;
      const drive = event.place ? driveMinutes(event.place) : null;
      const endMinutes = end ? (end.date === date ? end.minutes : 24 * 60) : null;
      out.push({
        key: `${calendar.id}:${event.uid}`,
        who: calendar.who,
        sport: calendar.sport,
        title: event.title,
        allDay: !start,
        start: start?.minutes ?? null,
        end: endMinutes,
        status: event.status,
        changed: event.changed,
        optional: event.optional,
        arriveBy,
        place: event.place,
        placeName: placeName(event.place),
        driveMinutes: drive,
        leaveAt: start && drive !== null ? (arriveBy ?? start.minutes) - drive : null,
        backAt: endMinutes !== null && drive !== null ? endMinutes + drive : null,
      });
    }
  }
  return out.sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
}

/**
 * Tonight's schedule as plain lines for Claude, with the arithmetic already
 * done (when to leave, when they're back) so it never has to guess.
 */
export function describeSchedule(events: TonightEvent[]): string {
  return events
    .map((e) => {
      if (e.allDay) return `- ${e.who} (${e.sport}): ${e.title}, all day${e.placeName ? ` at ${e.placeName}` : ""}`;
      const parts = [
        `${e.who} (${e.sport}): ${e.title}${e.optional ? " (optional)" : ""}${e.status === "tba" ? " (time not final)" : ""}`,
        `${clockLabel(e.start!)}${e.end !== null ? `–${clockLabel(e.end)}` : ""}`,
        e.arriveBy !== null ? `be there by ${clockLabel(e.arriveBy)}` : "",
        e.placeName ? `at ${e.placeName}` : "",
        e.driveMinutes !== null ? `${e.driveMinutes} min drive each way` : "",
        e.leaveAt !== null ? `leave home ${clockLabel(e.leaveAt)}` : "",
        e.backAt !== null ? `home again about ${clockLabel(e.backAt)}` : "",
      ];
      return `- ${parts.filter(Boolean).join(", ")}`;
    })
    .join("\n");
}
