"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { familySettings, member } from "@/db/schema";
import { setupInputSchema, type SetupInput } from "@/lib/family";
import { seedStarterRecipes } from "@/lib/recipes/seed";
import { getFamilySettings, requireParentSession, setActingMember } from "@/lib/session";

export async function completeSetup(input: SetupInput): Promise<{ error: string } | void> {
  const session = await requireParentSession();
  if ((await getFamilySettings())?.setupCompletedAt) redirect("/");

  const parsed = setupInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Something doesn't look right." };
  }
  const { settings, members, starterSlugs } = parsed.data;
  const signedInEmail = session.user.email.toLowerCase();
  if (!members.some((m) => m.role === "parent" && m.authEmail === signedInEmail)) {
    return { error: `Add yourself as a parent with ${signedInEmail} so you can get back in.` };
  }

  const createdIds = await db.transaction(async (tx) => {
    await tx
      .insert(familySettings)
      .values({ id: 1, ...settings, setupCompletedAt: new Date() })
      .onConflictDoUpdate({
        target: familySettings.id,
        set: { ...settings, setupCompletedAt: new Date() },
      });
    const rows = await tx
      .insert(member)
      .values(members.map((m, index) => ({ ...m, sortOrder: index })))
      .returning({ id: member.id, authEmail: member.authEmail });
    return rows;
  });

  await seedStarterRecipes(db, starterSlugs);

  const me = createdIds.find((m) => m.authEmail === signedInEmail);
  if (me) await setActingMember(me.id);
  redirect("/");
}
