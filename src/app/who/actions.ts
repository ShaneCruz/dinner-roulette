"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { member } from "@/db/schema";
import { verifyPin } from "@/lib/crypto";
import { clearActingMember, requireFamily, setActingMember } from "@/lib/session";

export async function chooseMember(
  memberId: string,
  pin: string | null,
): Promise<{ error: "pin_required" | "wrong_pin" | "not_found" } | void> {
  await requireFamily();
  const [chosen] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), isNull(member.archivedAt)))
    .limit(1);
  if (!chosen) return { error: "not_found" };
  if (chosen.pinHash) {
    if (!pin) return { error: "pin_required" };
    if (!verifyPin(pin, chosen.pinHash)) return { error: "wrong_pin" };
  }
  await setActingMember(chosen.id);
  redirect("/");
}

export async function switchMember() {
  await clearActingMember();
  redirect("/who");
}
