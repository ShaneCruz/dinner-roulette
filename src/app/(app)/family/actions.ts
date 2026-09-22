"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { member, memberAvailability, memberFoodRule } from "@/db/schema";
import { hashPin, isValidPin } from "@/lib/crypto";
import { AVATAR_COLORS, memberInputSchema, type MemberInput } from "@/lib/family";
import { requireActingMember, requireParentMember } from "@/lib/session";

type Result = { error: string } | void;

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Something doesn't look right.";

export async function saveMember(id: string | null, input: MemberInput): Promise<Result> {
  await requireParentMember();
  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    if (id) {
      await db.update(member).set(parsed.data).where(eq(member.id, id));
    } else {
      const [created] = await db.insert(member).values(parsed.data).returning({ id: member.id });
      id = created.id;
    }
  } catch (error) {
    if (String(error).includes("member_auth_email_unique")) {
      return { error: "Another person already uses that email." };
    }
    throw error;
  }
  revalidatePath("/family");
  redirect(`/family/${id}`);
}

export async function archiveMember(id: string) {
  const { acting } = await requireParentMember();
  if (acting.id === id) return;
  await db.update(member).set({ archivedAt: new Date() }).where(eq(member.id, id));
  revalidatePath("/family");
  redirect("/family");
}

export async function setPin(memberId: string, pin: string | null): Promise<Result> {
  const { acting } = await requireActingMember();
  if (acting.role !== "parent" && acting.id !== memberId) return { error: "Parents only." };
  if (pin !== null && !isValidPin(pin)) return { error: "A PIN is exactly 4 digits." };
  await db
    .update(member)
    .set({ pinHash: pin === null ? null : hashPin(pin) })
    .where(eq(member.id, memberId));
  revalidatePath(`/family/${memberId}`);
}

const lookSchema = z.object({
  avatarEmoji: z.string().min(1).max(16),
  avatarColor: z.enum(AVATAR_COLORS as [string, ...string[]]),
  chefTitle: z.string().trim().max(60).nullable(),
});

/** Kids can restyle themselves without a parent. */
export async function updateOwnLook(input: z.input<typeof lookSchema>): Promise<Result> {
  const { acting } = await requireActingMember();
  const parsed = lookSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await db.update(member).set(parsed.data).where(eq(member.id, acting.id));
  revalidatePath("/", "layout");
}

const foodRuleSchema = z
  .object({
    kind: z.enum(["nope", "love"]),
    ingredient: z.string().trim().toLowerCase().min(1).nullable(),
    recipeId: z.uuid().nullable(),
    note: z.string().trim().max(200).nullable(),
  })
  .refine((r) => (r.ingredient === null) !== (r.recipeId === null), {
    message: "Pick an ingredient or a recipe",
  });

export async function addFoodRule(
  memberId: string,
  input: z.input<typeof foodRuleSchema>,
): Promise<Result> {
  await requireParentMember();
  const parsed = foodRuleSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await db.insert(memberFoodRule).values({ memberId, ...parsed.data });
  revalidatePath(`/family/${memberId}`);
}

export async function removeFoodRule(memberId: string, ruleId: string) {
  await requireParentMember();
  await db
    .delete(memberFoodRule)
    .where(and(eq(memberFoodRule.id, ruleId), eq(memberFoodRule.memberId, memberId)));
  revalidatePath(`/family/${memberId}`);
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const availabilitySchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    presence: z.enum(["home", "away"]),
    label: z.string().trim().min(1, "Give it a name, like “Winter break”").max(80),
    tentative: z.boolean(),
    note: z.string().trim().max(200).nullable(),
  })
  .refine((r) => r.endDate >= r.startDate, {
    message: "The end date is before the start date",
  });

export async function saveAvailability(
  memberId: string,
  id: string | null,
  input: z.input<typeof availabilitySchema>,
): Promise<Result> {
  await requireParentMember();
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (id) {
    await db
      .update(memberAvailability)
      .set(parsed.data)
      .where(and(eq(memberAvailability.id, id), eq(memberAvailability.memberId, memberId)));
  } else {
    await db.insert(memberAvailability).values({ memberId, ...parsed.data });
  }
  revalidatePath("/", "layout");
}

export async function confirmAvailability(memberId: string, id: string) {
  await requireParentMember();
  await db
    .update(memberAvailability)
    .set({ tentative: false })
    .where(and(eq(memberAvailability.id, id), eq(memberAvailability.memberId, memberId)));
  revalidatePath("/", "layout");
}

export async function deleteAvailability(memberId: string, id: string) {
  await requireParentMember();
  await db
    .delete(memberAvailability)
    .where(and(eq(memberAvailability.id, id), eq(memberAvailability.memberId, memberId)));
  revalidatePath("/", "layout");
}

/** Adds the date ranges a parent kept after reviewing an imported calendar. */
export async function importAvailability(
  memberId: string,
  ranges: z.input<typeof availabilitySchema>[],
): Promise<Result | { added: number }> {
  await requireParentMember();
  if (!z.uuid().safeParse(memberId).success || ranges.length > 60) return { error: "Couldn't add those dates." };
  const parsed = ranges.map((r) => availabilitySchema.safeParse(r));
  const bad = parsed.find((p) => !p.success);
  if (bad && !bad.success) return { error: firstIssue(bad.error) };
  const rows = parsed.flatMap((p) => (p.success ? [{ memberId, ...p.data }] : []));
  if (rows.length) await db.insert(memberAvailability).values(rows);
  revalidatePath("/", "layout");
  return { added: rows.length };
}
