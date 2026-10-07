"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { familySettings, member, sportCalendar } from "@/db/schema";
import { FeedError, fetchSportsCalendar, refreshCalendar } from "@/lib/sports/store";
import { settingsInputSchema, type SettingsInput } from "@/lib/family";
import { requireParentMember } from "@/lib/session";

const grillCapsSchema = z.object({
  summer: z.number().int().min(0).max(7),
  shoulder: z.number().int().min(0).max(7),
  winter: z.number().int().min(0).max(7),
});

export async function updateSettings(
  input: SettingsInput,
  grillCaps: z.input<typeof grillCapsSchema>,
): Promise<{ error: string } | { ok: true }> {
  await requireParentMember();
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const caps = grillCapsSchema.safeParse(grillCaps);
  if (!caps.success) return { error: "Grill nights must be between 0 and 7." };
  await db
    .update(familySettings)
    .set({ ...parsed.data, grillCaps: caps.data })
    .where(eq(familySettings.id, 1));
  revalidatePath("/", "layout");
  return { ok: true };
}

const reminderSchema = z.object({
  dinnerTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a dinner time"),
  autopilotEnabled: z.boolean(),
  autopilotDay: z.number().int().min(0).max(6),
  reminders: z.object({
    thaw: z.boolean(),
    start: z.boolean(),
    rate: z.boolean(),
    autopilot: z.boolean(),
    proposals: z.boolean(),
  }),
});

export async function updateReminderSettings(
  input: z.input<typeof reminderSchema>,
): Promise<{ error: string } | { ok: true }> {
  await requireParentMember();
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  await db.update(familySettings).set(parsed.data).where(eq(familySettings.id, 1));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAiBudget(dollars: number): Promise<{ error: string } | { ok: true }> {
  await requireParentMember();
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 200) return { error: "Pick a budget between $0 and $200 a week." };
  await db.update(familySettings).set({ aiWeeklyBudgetCents: Math.round(dollars * 100) }).where(eq(familySettings.id, 1));
  revalidatePath("/settings");
  return { ok: true };
}

/** Adds a team's calendar feed for someone, reading it first so a bad link says so now. */
export async function addSportCalendarAction(input: {
  memberId: string;
  label: string;
  url: string;
}): Promise<{ error: string } | { ok: true; events: number }> {
  const { settings } = await requireParentMember();
  const parsed = z
    .object({ memberId: z.uuid(), label: z.string().trim().min(1, "Name it, e.g. Soccer").max(40), url: z.string().trim().min(8).max(2000) })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a person and paste the calendar link." };
  const [who] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, parsed.data.memberId), isNull(member.archivedAt)));
  if (!who) return { error: "Pick a person." };
  try {
    const events = await fetchSportsCalendar(parsed.data.url, settings.timezone);
    if (!events.length) return { error: "That calendar is empty. Check it's the right team." };
    await db.insert(sportCalendar).values({ ...parsed.data, events, fetchedAt: new Date() });
    revalidatePath("/", "layout");
    return { ok: true, events: events.length };
  } catch (error) {
    if (error instanceof FeedError) return { error: error.message };
    console.error("Adding a sports calendar failed", error);
    return { error: "Couldn't read that calendar." };
  }
}

export async function removeSportCalendarAction(id: string) {
  await requireParentMember();
  if (!z.uuid().safeParse(id).success) return;
  await db.delete(sportCalendar).where(eq(sportCalendar.id, id));
  revalidatePath("/", "layout");
}

/** Reads a calendar again now, rather than waiting for the hourly refresh. */
export async function refreshSportCalendarAction(id: string) {
  const { settings } = await requireParentMember();
  if (!z.uuid().safeParse(id).success) return;
  const [calendar] = await db.select().from(sportCalendar).where(eq(sportCalendar.id, id));
  if (calendar) await refreshCalendar(db, calendar, settings.timezone);
  revalidatePath("/", "layout");
}
