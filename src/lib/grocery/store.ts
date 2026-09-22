import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { groceryClaim, groceryItem } from "@/db/schema";
import { STORE_SECTIONS, UNITS } from "@/lib/recipes/schema";

export type GroceryItemRow = typeof groceryItem.$inferSelect;

export const groceryOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("check"), id: z.uuid(), checked: z.boolean() }),
  z.object({
    op: z.literal("add"),
    /** Client-generated id so offline adds can be checked before they sync */
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    quantity: z.number().positive().nullable(),
    unit: z.enum(UNITS),
    section: z.enum(STORE_SECTIONS),
  }),
  z.object({ op: z.literal("remove"), id: z.uuid() }),
  z.object({ op: z.literal("claim"), section: z.enum(STORE_SECTIONS), claim: z.boolean() }),
]);
export type GroceryOp = z.infer<typeof groceryOpSchema>;

export async function applyGroceryOp(
  db: Database,
  weekPlanId: string,
  memberId: string | null,
  op: GroceryOp,
) {
  switch (op.op) {
    case "check":
      await db
        .update(groceryItem)
        .set({ checked: op.checked, checkedByMemberId: op.checked ? memberId : null })
        .where(and(eq(groceryItem.id, op.id), eq(groceryItem.weekPlanId, weekPlanId)));
      return;
    case "add":
      await db
        .insert(groceryItem)
        .values({
          id: op.id,
          weekPlanId,
          key: `manual|${op.id}`,
          name: op.name,
          quantity: op.quantity,
          unit: op.unit,
          section: op.section,
          isManual: true,
        })
        .onConflictDoNothing();
      return;
    case "remove":
      // Only hand-added items can be removed; recipe items come and go with the plan.
      await db
        .delete(groceryItem)
        .where(
          and(eq(groceryItem.id, op.id), eq(groceryItem.weekPlanId, weekPlanId), eq(groceryItem.isManual, true)),
        );
      return;
    case "claim":
      if (!memberId) return;
      if (op.claim) {
        await db
          .insert(groceryClaim)
          .values({ weekPlanId, section: op.section, memberId })
          .onConflictDoUpdate({
            target: [groceryClaim.weekPlanId, groceryClaim.section],
            set: { memberId },
          });
      } else {
        await db
          .delete(groceryClaim)
          .where(and(eq(groceryClaim.weekPlanId, weekPlanId), eq(groceryClaim.section, op.section)));
      }
      return;
  }
}

export type GrocerySnapshot = {
  items: {
    id: string;
    name: string;
    quantity: number | null;
    unit: string;
    section: string;
    sources: { recipeTitle: string; date: string }[];
    isManual: boolean;
    isStaple: boolean;
    isStale: boolean;
    checked: boolean;
    checkedByMemberId: string | null;
  }[];
  claims: { section: string; memberId: string }[];
};

export async function grocerySnapshot(db: Database, weekPlanId: string): Promise<GrocerySnapshot> {
  const [items, claims] = await Promise.all([
    db.select().from(groceryItem).where(eq(groceryItem.weekPlanId, weekPlanId)).orderBy(asc(groceryItem.name)),
    db
      .select({ section: groceryClaim.section, memberId: groceryClaim.memberId })
      .from(groceryClaim)
      .where(eq(groceryClaim.weekPlanId, weekPlanId)),
  ]);
  return {
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      section: i.section,
      sources: i.sources,
      isManual: i.isManual,
      isStaple: i.isStaple,
      isStale: i.isStale,
      checked: i.checked,
      checkedByMemberId: i.checkedByMemberId,
    })),
    claims,
  };
}
