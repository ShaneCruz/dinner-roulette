import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { cardGrant, cardUse, member } from "@/db/schema";

/**
 * Veto cards and power-ups. Every kid gets one veto a week for free.
 * Power-ups (Double Down, Respin, Chef's Pick) are handed out by parents
 * and are spent once.
 */

import { type CardType } from "./card-info";

export { CARDS, isLockedPick, type CardType } from "./card-info";

export const VETOES_PER_WEEK = 1;

export type Hand = {
  memberId: string;
  vetoesLeft: number;
  powerUps: Record<Exclude<CardType, "veto">, number>;
};

export async function loadHands(db: Database, weekStart: string): Promise<Map<string, Hand>> {
  const [members, grants, uses] = await Promise.all([
    db.select({ id: member.id, role: member.role }).from(member).where(isNull(member.archivedAt)),
    db.select().from(cardGrant).where(isNull(cardGrant.usedAt)),
    db.select().from(cardUse).where(and(eq(cardUse.weekStart, weekStart), eq(cardUse.card, "veto"))),
  ]);
  const hands = new Map<string, Hand>();
  for (const m of members) {
    const vetoesUsed = uses.filter((u) => u.memberId === m.id).length;
    const mine = grants.filter((g) => g.memberId === m.id);
    hands.set(m.id, {
      memberId: m.id,
      vetoesLeft: m.role === "kid" ? Math.max(0, VETOES_PER_WEEK - vetoesUsed) : 0,
      powerUps: {
        double_down: mine.filter((g) => g.card === "double_down").length,
        respin: mine.filter((g) => g.card === "respin").length,
        chefs_pick: mine.filter((g) => g.card === "chefs_pick").length,
      },
    });
  }
  return hands;
}

export async function grantCard(
  db: Database,
  memberId: string,
  card: Exclude<CardType, "veto">,
  options: { reason?: string | null; grantedBy?: string | null } = {},
) {
  await db.insert(cardGrant).values({
    memberId,
    card,
    reason: options.reason ?? null,
    grantedByMemberId: options.grantedBy ?? null,
  });
}

/**
 * Plays a card. Returns false if the member doesn't have one to play.
 * Runs in a transaction so a double tap can't spend two.
 */
export async function playCard(
  db: Database,
  memberId: string,
  card: CardType,
  weekStart: string,
  recipeId: string | null = null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (card === "veto") {
      const [who] = await tx.select({ role: member.role }).from(member).where(eq(member.id, memberId));
      if (who?.role !== "kid") return false;
      const used = await tx
        .select({ id: cardUse.id, recipeId: cardUse.recipeId })
        .from(cardUse)
        .where(and(eq(cardUse.weekStart, weekStart), eq(cardUse.memberId, memberId), eq(cardUse.card, "veto")));
      if (used.length >= VETOES_PER_WEEK) return false;
    } else {
      const [grant] = await tx
        .select({ id: cardGrant.id })
        .from(cardGrant)
        .where(and(eq(cardGrant.memberId, memberId), eq(cardGrant.card, card), isNull(cardGrant.usedAt)))
        .orderBy(asc(cardGrant.createdAt))
        .limit(1);
      if (!grant) return false;
      await tx.update(cardGrant).set({ usedAt: new Date() }).where(eq(cardGrant.id, grant.id));
    }
    await tx.insert(cardUse).values({ memberId, card, weekStart, recipeId });
    return true;
  });
}

/** Takes back a veto played this week (a parent overruling, or a mis-tap). */
export async function undoVeto(db: Database, memberId: string, weekStart: string, recipeId: string) {
  await db
    .delete(cardUse)
    .where(
      and(
        eq(cardUse.memberId, memberId),
        eq(cardUse.weekStart, weekStart),
        eq(cardUse.card, "veto"),
        eq(cardUse.recipeId, recipeId),
      ),
    );
}

export async function weekVetoes(db: Database, weekStart: string) {
  const rows = await db
    .select({ memberId: cardUse.memberId, recipeId: cardUse.recipeId })
    .from(cardUse)
    .where(and(eq(cardUse.weekStart, weekStart), eq(cardUse.card, "veto")));
  return rows.filter((r): r is { memberId: string; recipeId: string } => Boolean(r.recipeId));
}
