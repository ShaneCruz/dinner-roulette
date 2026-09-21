/**
 * Who is home for dinner on a given day. Dates are plain "YYYY-MM-DD"
 * strings in the family's timezone; a range covers its start and end dates.
 */
export type PresenceValue = "home" | "away";

export type PresenceMember = {
  id: string;
  name: string;
  defaultPresence: PresenceValue;
};

export type PresenceRange = {
  id: string;
  memberId: string;
  startDate: string;
  endDate: string;
  presence: PresenceValue;
  label: string;
  tentative: boolean;
};

export type DayPresence = {
  presence: PresenceValue;
  /** The range that decided it, if any */
  range: PresenceRange | null;
  /** A tentative range covers this day and still needs a parent to confirm */
  unconfirmed: PresenceRange | null;
};

export function todayIn(timezone: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hourIn(timezone: string, now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(
      now,
    ),
  );
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000,
  );
}

function covers(range: PresenceRange, date: string) {
  return range.startDate <= date && date <= range.endDate;
}

function length(range: PresenceRange) {
  return daysBetween(range.startDate, range.endDate);
}

/**
 * Confirmed ranges override the default; when ranges overlap the shortest
 * (most specific) wins, so "out Friday" beats "home for winter break".
 */
export function presenceOn(
  member: PresenceMember,
  ranges: PresenceRange[],
  date: string,
): DayPresence {
  const mine = ranges.filter((r) => r.memberId === member.id && covers(r, date));
  const confirmed = mine
    .filter((r) => !r.tentative)
    .sort((a, b) => length(a) - length(b));
  const unconfirmed = mine.find((r) => r.tentative) ?? null;
  const range = confirmed[0] ?? null;
  return { presence: range?.presence ?? member.defaultPresence, range, unconfirmed };
}

export type Homecoming<M extends PresenceMember = PresenceMember> = {
  member: M;
  range: PresenceRange;
  /** 0 = arrives today */
  daysUntil: number;
};

/**
 * Members who are usually away (boarding school) and have a confirmed home
 * range starting within `withinDays`, or that started today.
 */
export function upcomingHomecomings<M extends PresenceMember>(
  members: M[],
  ranges: PresenceRange[],
  today: string,
  withinDays = 7,
): Homecoming<M>[] {
  const result: Homecoming<M>[] = [];
  for (const member of members) {
    if (member.defaultPresence !== "away") continue;
    const next = ranges
      .filter(
        (r) =>
          r.memberId === member.id &&
          r.presence === "home" &&
          !r.tentative &&
          r.startDate >= today &&
          daysBetween(today, r.startDate) <= withinDays,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (next) result.push({ member, range: next, daysUntil: daysBetween(today, next.startDate) });
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Tentative ranges starting within `withinDays` that a parent should confirm. */
export function rangesNeedingConfirmation(
  ranges: PresenceRange[],
  today: string,
  withinDays = 10,
): PresenceRange[] {
  return ranges
    .filter(
      (r) =>
        r.tentative &&
        r.endDate >= today &&
        daysBetween(today, r.startDate) <= withinDays,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Departures from the normal routine in the next `withinDays` days: someone
 * who is usually home going away, or a usually-away member's planned home
 * visit being cancelled (an "away" range inside a break). Used for alerts
 * like "Kaela is not home Oct 16-20. Jamie is away."
 */
export function upcomingExceptions<M extends PresenceMember>(
  members: M[],
  ranges: PresenceRange[],
  today: string,
  withinDays = 14,
): { member: M; range: PresenceRange }[] {
  const horizon = addDays(today, withinDays);
  return ranges
    .filter(
      (r) =>
        !r.tentative &&
        r.presence === "away" &&
        r.endDate >= today &&
        r.startDate <= horizon,
    )
    .map((range) => ({ member: members.find((m) => m.id === range.memberId)!, range }))
    .filter((x) => x.member)
    .sort((a, b) => a.range.startDate.localeCompare(b.range.startDate));
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: withMonth ? "short" : undefined,
      day: "numeric",
    });
  if (start === end) return fmt(start, true);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`;
}
