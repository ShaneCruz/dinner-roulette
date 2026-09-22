import type { ReminderPrefs } from "@/db/schema";

/**
 * Decides which reminders are due right now. Pure, so it's easy to test;
 * the scheduler loads the state, calls this every 15 minutes, and sends
 * each reminder once (by key).
 */

export type ReminderMeal = {
  id: string;
  date: string;
  status: "planned" | "cooked" | "skipped";
  title: string;
  slug: string;
  totalMinutes: number;
  /** Meat and seafood ingredients, for thaw reminders */
  proteins: string[];
  eaterIds: string[];
  ratedIds: string[];
};

export type Reminder = {
  key: string;
  to: "parents" | string[];
  title: string;
  body: string;
  url: string;
};

export const THAW_MINUTES = 20 * 60; // 8:00 PM the night before
const RATE_DELAY = 90; // minutes after dinner

/** "18:30" → 1110 */
export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 18 * 60;
}

export function minutesIn(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function dueReminders(input: {
  prefs: ReminderPrefs;
  dinnerTime: string;
  nowMinutes: number;
  today: ReminderMeal | null;
  tomorrow: ReminderMeal | null;
}): Reminder[] {
  const { prefs, nowMinutes, today, tomorrow } = input;
  const dinner = parseClock(input.dinnerTime);
  const out: Reminder[] = [];

  if (prefs.start && today?.status === "planned") {
    const startAt = Math.max(dinner - today.totalMinutes - 10, 7 * 60);
    // Only in the window before dinner; a missed window isn't worth a late ping.
    if (nowMinutes >= startAt && nowMinutes < Math.min(startAt + 60, dinner)) {
      out.push({
        key: `start:${today.date}`,
        to: "parents",
        title: `Time to start ${today.title}`,
        body: `It takes ${duration(today.totalMinutes)}. Start now to eat around ${clockLabel(dinner)}.`,
        url: `/cook/${today.slug}`,
      });
    }
  }

  if (prefs.thaw && tomorrow?.status === "planned" && tomorrow.proteins.length && nowMinutes >= THAW_MINUTES && nowMinutes < 23 * 60) {
    const slowStart = tomorrow.totalMinutes >= 4 * 60 ? ` It takes ${duration(tomorrow.totalMinutes)}, so plan to start it early.` : "";
    out.push({
      key: `thaw:${tomorrow.date}`,
      to: "parents",
      title: `Tomorrow: ${tomorrow.title}`,
      body: `If the ${list(tomorrow.proteins)} ${tomorrow.proteins.length > 1 ? "are" : "is"} frozen, move it to the fridge tonight.${slowStart}`,
      url: `/recipes/${tomorrow.slug}`,
    });
  }

  if (prefs.rate && today && today.status !== "skipped" && nowMinutes >= dinner + RATE_DELAY && nowMinutes < 23 * 60) {
    if (today.status === "cooked") {
      const waiting = today.eaterIds.filter((id) => !today.ratedIds.includes(id));
      if (waiting.length) {
        out.push({
          key: `rate:${today.date}`,
          to: waiting,
          title: `How was ${today.title}?`,
          body: "Tap a face. It takes ten seconds and makes next week's dinners better.",
          url: `/rate/${today.id}`,
        });
      }
    } else {
      out.push({
        key: `rate:${today.date}`,
        to: "parents",
        title: `Did you make ${today.title}?`,
        body: "Mark it made and rate it, so the planner learns what everyone liked.",
        url: "/",
      });
    }
  }
  return out;
}
