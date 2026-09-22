import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { sessionVote } from "@/db/schema";

/** Swipe-round votes: -1 nope, 1 yes, 2 love, 4 a doubled-down love. */
export const VOTE = { nope: -1, yes: 1, love: 2, doubled: 4 } as const;

export async function castVote(db: Database, weekStart: string, memberId: string, recipeId: string, vote: number) {
  await db
    .insert(sessionVote)
    .values({ weekStart, memberId, recipeId, vote })
    .onConflictDoUpdate({
      target: [sessionVote.weekStart, sessionVote.memberId, sessionVote.recipeId],
      set: { vote, updatedAt: new Date() },
    });
}

export async function clearVotes(db: Database, weekStart: string, memberId: string) {
  await db.delete(sessionVote).where(and(eq(sessionVote.weekStart, weekStart), eq(sessionVote.memberId, memberId)));
}

export async function weekVotes(db: Database, weekStart: string) {
  return db
    .select({ memberId: sessionVote.memberId, recipeId: sessionVote.recipeId, vote: sessionVote.vote })
    .from(sessionVote)
    .where(eq(sessionVote.weekStart, weekStart));
}

/** memberId -> recipeId -> vote */
export function votesByMember(rows: { memberId: string; recipeId: string; vote: number }[]) {
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const mine = out.get(r.memberId) ?? {};
    mine[r.recipeId] = r.vote;
    out.set(r.memberId, mine);
  }
  return out;
}
