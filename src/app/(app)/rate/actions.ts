"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { plannedMeal } from "@/db/schema";
import { REASON_IDS } from "@/lib/ratings/scale";
import { saveRatings } from "@/lib/ratings/store";
import { requireActingMember } from "@/lib/session";

const entrySchema = z.object({
  memberId: z.uuid(),
  stars: z.number().int().min(1).max(5),
  reasons: z.array(z.enum(REASON_IDS)).max(REASON_IDS.length),
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function submitRatings(
  plannedMealId: string,
  entries: z.input<typeof entrySchema>[],
): Promise<{ error: string } | { saved: number }> {
  const { acting } = await requireActingMember();
  const parsed = entrySchema.array().min(1).safeParse(entries);
  if (!parsed.success) return { error: "Pick a face for at least one person." };

  const [meal] = await db.select().from(plannedMeal).where(eq(plannedMeal.id, plannedMealId)).limit(1);
  if (!meal?.recipeId) return { error: "That dinner isn't on the plan anymore." };

  // Kids rate for themselves; parents can rate for the whole table.
  const allowed = acting.role === "parent" ? parsed.data : parsed.data.filter((e) => e.memberId === acting.id);
  if (!allowed.length) return { error: "You can only rate for yourself." };

  await saveRatings(db, { id: meal.id, recipeId: meal.recipeId }, allowed, acting.id);
  revalidatePath("/", "layout");
  return { saved: allowed.length };
}
