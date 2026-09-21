import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { familySettings, member } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sign, unsign } from "@/lib/crypto";

export type Member = typeof member.$inferSelect;

const ACTING_MEMBER_COOKIE = "dr_member";

export const getParentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getFamilySettings = cache(async () => {
  const [settings] = await db.select().from(familySettings).limit(1);
  return settings ?? null;
});

export const getActiveMembers = cache(async (): Promise<Member[]> => {
  return db
    .select()
    .from(member)
    .where(isNull(member.archivedAt))
    .orderBy(asc(member.sortOrder), asc(member.createdAt));
});

export async function requireParentSession() {
  const session = await getParentSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Signed-in device, finished setup. Used by every page inside the app. */
export async function requireFamily() {
  const session = await requireParentSession();
  const settings = await getFamilySettings();
  if (!settings?.setupCompletedAt) redirect("/setup");
  return { session, settings };
}

export const getActingMember = cache(async (): Promise<Member | null> => {
  const raw = (await cookies()).get(ACTING_MEMBER_COOKIE)?.value;
  const memberId = raw ? unsign(raw) : null;
  if (!memberId) return null;
  const [found] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), isNull(member.archivedAt)))
    .limit(1);
  return found ?? null;
});

/** Everything a page needs to know about who is using the app right now. */
export async function requireActingMember() {
  const { session, settings } = await requireFamily();
  const acting = await getActingMember();
  if (!acting) redirect("/who");
  return { session, settings, acting };
}

/** Parent-only pages and actions; kids get bounced home. */
export async function requireParentMember() {
  const context = await requireActingMember();
  if (context.acting.role !== "parent") redirect("/");
  return context;
}

export async function setActingMember(memberId: string) {
  (await cookies()).set(ACTING_MEMBER_COOKIE, sign(memberId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearActingMember() {
  (await cookies()).delete(ACTING_MEMBER_COOKIE);
}

/**
 * The parent profile that belongs to the signed-in Google account, used to
 * skip the picker (and PIN) when a parent signs in on their own phone.
 */
export async function findParentMemberForEmail(email: string): Promise<Member | null> {
  const [found] = await db
    .select()
    .from(member)
    .where(and(eq(member.authEmail, email.toLowerCase()), isNull(member.archivedAt)))
    .limit(1);
  return found ?? null;
}
