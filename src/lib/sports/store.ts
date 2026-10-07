import "server-only";
import { asc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { driveTime, member, sportCalendar } from "@/db/schema";
import { parseSportsCalendar } from "./ics";
import { eventsOn, type TonightEvent } from "./schedule";

const MAX_BYTES = 3 * 1024 * 1024;
/** Team apps refresh their feeds about hourly; no point asking more often. */
const FRESH_MINUTES = 60;

export class FeedError extends Error {}

/** webcal:// is just https:// for calendars. */
export function feedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new FeedError("That doesn't look like a calendar link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FeedError("That doesn't look like a calendar link.");
  // Don't let the server be pointed at itself or the local network.
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new FeedError("That link isn't a public calendar.");
  }
  return url;
}

/** Downloads and reads a team calendar. */
export async function fetchSportsCalendar(raw: string, timeZone: string) {
  const url = feedUrl(raw);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/calendar, */*", "User-Agent": "Mozilla/5.0 (compatible; DinnerRoulette/1.0; family calendar)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new FeedError("Couldn't reach that calendar. Check the link and try again.");
  }
  if (!response.ok) throw new FeedError(`The calendar answered with an error (${response.status}). The link may have expired.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new FeedError("That calendar is too big to read.");
  const text = new TextDecoder().decode(buffer);
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new FeedError("That link isn't a calendar feed. Look for a “Subscribe” or “iCal” link in the team app.");
  return parseSportsCalendar(text, timeZone);
}

/** Re-downloads a calendar, keeping the last good copy if the team app is down. */
export async function refreshCalendar(db: Database, calendar: typeof sportCalendar.$inferSelect, timeZone: string) {
  try {
    const events = await fetchSportsCalendar(calendar.url, timeZone);
    await db.update(sportCalendar).set({ events, fetchedAt: new Date(), fetchError: null }).where(eq(sportCalendar.id, calendar.id));
    return events;
  } catch (error) {
    const message = error instanceof FeedError ? error.message : "Couldn't read that calendar.";
    if (!(error instanceof FeedError)) console.error("Sports calendar refresh failed", error);
    await db.update(sportCalendar).set({ fetchError: message }).where(eq(sportCalendar.id, calendar.id));
    return calendar.events;
  }
}

/** Every calendar, with the person it belongs to, freshened if it's been a while. */
export async function loadSportsCalendars(db: Database, timeZone: string, now = new Date()) {
  const rows = await db
    .select({ calendar: sportCalendar, who: member.name })
    .from(sportCalendar)
    .innerJoin(member, eq(member.id, sportCalendar.memberId))
    .where(isNull(member.archivedAt))
    .orderBy(asc(member.sortOrder), asc(sportCalendar.createdAt));
  return Promise.all(
    rows.map(async ({ calendar, who }) => {
      const stale = !calendar.fetchedAt || now.getTime() - calendar.fetchedAt.getTime() > FRESH_MINUTES * 60_000;
      const events = stale ? await refreshCalendar(db, calendar, timeZone) : calendar.events;
      return { id: calendar.id, who, sport: calendar.label, events };
    }),
  );
}

// ---------------------------------------------------------------------------
// Drive times
// ---------------------------------------------------------------------------

const normalize = (address: string) => address.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function mapsEnabled(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/**
 * Minutes from home to a place, by car in ordinary traffic. Looked up once
 * per place with Google's Routes API and kept, so the same fields cost
 * nothing after the first time. Null without a key or a home address.
 */
export async function driveMinutesTo(db: Database, home: string | null, place: string): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !home?.trim()) return null;
  const key = `${normalize(home)} -> ${normalize(place)}`;
  const [known] = await db.select().from(driveTime).where(eq(driveTime.key, key)).limit(1);
  if (known) return known.minutes;
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: home },
        destination: { address: place },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Drive time lookup failed", response.status, (await response.text()).slice(0, 300));
      return null;
    }
    const data = (await response.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
    const route = data.routes?.[0];
    const seconds = Number(route?.duration?.replace(/s$/, ""));
    if (!route || !Number.isFinite(seconds)) return null;
    const minutes = Math.max(1, Math.round(seconds / 60));
    await db
      .insert(driveTime)
      .values({ key, minutes, meters: route.distanceMeters ?? 0 })
      .onConflictDoNothing();
    return minutes;
  } catch (error) {
    console.error("Drive time lookup failed", error);
    return null;
  }
}

/** Tonight's practices and games (or any date's), with drive times. */
export async function scheduleOn(
  db: Database,
  settings: { timezone: string; homeAddress: string | null },
  date: string,
): Promise<TonightEvent[]> {
  const calendars = await loadSportsCalendars(db, settings.timezone);
  if (!calendars.length) return [];
  // Look up each place once, before building the day.
  const first = eventsOn(calendars, date, settings.timezone, () => null);
  const places = [...new Set(first.flatMap((e) => (e.place && e.status !== "cancelled" ? [e.place] : [])))];
  const minutes = new Map<string, number | null>();
  await Promise.all(places.map(async (place) => minutes.set(place, await driveMinutesTo(db, settings.homeAddress, place))));
  return eventsOn(calendars, date, settings.timezone, (place) => minutes.get(place) ?? null);
}

/** For the settings screen: each calendar, whose it is, and how it's doing. */
export async function listSportsCalendars(db: Database) {
  return db
    .select({
      id: sportCalendar.id,
      memberId: sportCalendar.memberId,
      who: member.name,
      label: sportCalendar.label,
      url: sportCalendar.url,
      events: sportCalendar.events,
      fetchedAt: sportCalendar.fetchedAt,
      fetchError: sportCalendar.fetchError,
    })
    .from(sportCalendar)
    .innerJoin(member, eq(member.id, sportCalendar.memberId))
    .where(isNull(member.archivedAt))
    .orderBy(asc(member.sortOrder), asc(sportCalendar.createdAt));
}
