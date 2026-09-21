"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { familySettings } from "@/db/schema";
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
