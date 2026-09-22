"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema";
import { requireActingMember } from "@/lib/session";

/** Remembers that this person has seen the welcome, so it shows once. */
export async function markWelcomed() {
  const { acting } = await requireActingMember();
  await db.update(member).set({ welcomedAt: new Date() }).where(eq(member.id, acting.id));
}
