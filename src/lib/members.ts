import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { memberFoodRule } from "@/db/schema";
import type { AudienceMember } from "@/lib/recipes/audience";
import { getActiveMembers } from "@/lib/session";

/** Active members with their ingredient nopes, for matching recipe variants. */
export async function loadAudience(): Promise<AudienceMember[]> {
  const [members, nopes] = await Promise.all([
    getActiveMembers(),
    db
      .select({ memberId: memberFoodRule.memberId, ingredient: memberFoodRule.ingredient })
      .from(memberFoodRule)
      .where(and(eq(memberFoodRule.kind, "nope"), isNotNull(memberFoodRule.ingredient))),
  ]);
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    spiceTolerance: m.spiceTolerance,
    prefersHighProtein: m.prefersHighProtein,
    wantsHealthySwaps: m.wantsHealthySwaps,
    nopes: nopes.filter((n) => n.memberId === m.id).map((n) => n.ingredient!),
  }));
}
