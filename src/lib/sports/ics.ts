import type { SportEvent } from "@/db/schema";

/**
 * Reads a team calendar feed (iCalendar, as TeamSnap, PlayerFirst and most
 * league apps publish) into the events dinner planning cares about: when,
 * where, and whether it's actually happening.
 *
 * Team apps don't all use the calendar's own status field. PlayerFirst marks
 * a cancelled practice only in its title ("CANCELLED: Practice ..."), so the
 * title is read too.
 */

type Property = { params: Record<string, string>; value: string };

/** Lines in a feed wrap with a leading space; join them back up. */
function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescape(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function parseLine(line: string): [string, Property] | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return [name.toUpperCase(), { params, value: line.slice(colon + 1) }];
}

/** The UTC offset of a time zone at an instant, in minutes. */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs) / 60_000;
}

/** A wall-clock time in a time zone ("5:45 PM in Chicago") as a UTC instant, right across daylight-saving changes. */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0);
  const first = guess - offsetMinutes(guess, timeZone) * 60_000;
  const second = guess - offsetMinutes(first, timeZone) * 60_000;
  return second;
}

/** A calendar date-time as a UTC instant, or an all-day date. Floating times use the family's zone. */
function readTime(prop: Property | undefined, familyZone: string): { utc: number } | { date: string } | null {
  if (!prop) return null;
  const v = prop.value.trim();
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly || prop.params.VALUE === "DATE") {
    const m = dateOnly ?? v.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? { date: `${m[1]}-${m[2]}-${m[3]}` } : null;
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  if (m[7] === "Z") return { utc: Date.UTC(year, month - 1, day, hour, minute, second) };
  let zone = prop.params.TZID ?? familyZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    // A Windows-style zone name we can't read; the family's is the best guess.
    zone = familyZone;
  }
  return { utc: zonedTimeToUtc({ year, month, day, hour, minute, second }, zone) };
}

const STATUS_PREFIX = /^\s*(CANCELL?ED|CANCELED|POSTPONED|CHANGED|UPDATED|RESCHEDULED|TIME\s+TBA|TBA|TBD)\s*[:\-–]\s*/i;

/**
 * "CANCELLED: Practice U13 GA 26-27 Chicago FC United GA U13 at 8:15PM ..."
 * → { title: "Practice", status: "cancelled" }. Age-group tails, repeated
 * start times and uniform notes go; the useful part stays.
 */
export function readTitle(summary: string): { title: string; status: SportEvent["status"]; changed: boolean; optional: boolean } {
  let text = summary.trim();
  let status: SportEvent["status"] = "on";
  let changed = false;
  for (let match = text.match(STATUS_PREFIX); match; match = text.match(STATUS_PREFIX)) {
    const word = match[1].toUpperCase().replace(/\s+/g, " ");
    if (word.startsWith("CANCEL") || word === "POSTPONED") status = "cancelled";
    else if (word === "TIME TBA" || word === "TBA" || word === "TBD") status = status === "cancelled" ? status : "tba";
    else changed = true;
    text = text.slice(match[0].length);
  }
  const optional = /^optional\b/i.test(text);
  if (optional) text = text.replace(/^optional\s+/i, "");
  text = text
    // The start time repeated in the title, and everything after it
    .replace(/\s+at\s+\d{1,2}(:\d{2})?\s*[AP]M\b.*$/i, "")
    // Uniform and other notes after a sentence break
    .replace(/\s*\.\s*(uniform|arrival|other notes|notes)\b.*$/i, "")
    // An age group ("U13") and the team name after it
    .replace(/\s+U\d{1,2}\b.*$/, "")
    .trim();
  // "GA vs MI Jags" reads better as a game
  text = text.replace(/^[A-Z]{1,4}\s+(vs\.?|@|at)\s+/, (_, word: string) => (word === "@" || word === "at" ? "Game at " : "Game vs "));
  if (!text) text = summary.trim();
  return { title: text.length > 60 ? `${text.slice(0, 57)}…` : text, status, changed, optional };
}

/** "field Turf Zone 03: North Shore Sportscenter, 1900 Old Willow Rd Northbrook, IL" → the address part. */
export function readPlace(location: string | undefined): string | null {
  const text = unescape(location ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.replace(/^(field|court|rink|diamond|pitch)\b[^:]{0,40}:\s*/i, "").trim() || null;
}

/** "Arrival: 40 mins before kickoff" → 40 */
export function readArrival(text: string): number | null {
  const m = text.match(/arriv\w*[^.\d]{0,20}(\d{1,3})\s*(min|minutes|mins)\b/i);
  const minutes = m ? Number(m[1]) : NaN;
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 180 ? minutes : null;
}

/** Every event in a feed, read for dinner planning. */
export function parseSportsCalendar(text: string, familyZone: string): SportEvent[] {
  const events: SportEvent[] = [];
  let current: Map<string, Property> | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) {
      current = new Map();
      continue;
    }
    if (/^END:VEVENT$/i.test(line.trim())) {
      if (current) {
        const event = readEvent(current, familyZone);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = parseLine(line);
    // Keep the first of each property; that's the event's own (not an alarm's).
    if (parsed && !current.has(parsed[0])) current.set(parsed[0], parsed[1]);
  }
  return events.sort((a, b) => (a.startUtc ?? a.allDayDate ?? "").localeCompare(b.startUtc ?? b.allDayDate ?? ""));
}

function readEvent(props: Map<string, Property>, familyZone: string): SportEvent | null {
  const start = readTime(props.get("DTSTART"), familyZone);
  if (!start) return null;
  const end = readTime(props.get("DTEND"), familyZone);
  const summary = unescape(props.get("SUMMARY")?.value ?? "Event");
  const description = unescape(props.get("DESCRIPTION")?.value ?? "");
  const title = readTitle(summary);
  if (props.get("STATUS")?.value.trim().toUpperCase() === "CANCELLED") title.status = "cancelled";
  return {
    uid: props.get("UID")?.value.trim() || `${props.get("DTSTART")?.value}-${summary}`,
    startUtc: "utc" in start ? new Date(start.utc).toISOString() : null,
    endUtc: end && "utc" in end ? new Date(end.utc).toISOString() : null,
    allDayDate: "date" in start ? start.date : null,
    title: title.title,
    status: title.status,
    changed: title.changed,
    optional: title.optional,
    arriveEarlyMinutes: readArrival(`${summary} ${description}`),
    place: readPlace(props.get("LOCATION")?.value),
    notes: description.replace(/\s+/g, " ").trim().slice(0, 400),
  };
}
