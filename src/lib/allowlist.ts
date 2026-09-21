import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema";

function envAllowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Only parents sign in. An email may sign in if it is in ALLOWED_EMAILS
 * (needed to bootstrap setup) or belongs to an active parent profile.
 */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (envAllowlist().includes(normalized)) return true;
  const [parent] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.authEmail, normalized), eq(member.role, "parent"), isNull(member.archivedAt)),
    )
    .limit(1);
  return Boolean(parent);
}
