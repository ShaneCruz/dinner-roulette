import { rankForNight, seededRandom, type Chosen, type EngineContext, type EngineNight } from "@/lib/suggest/engine";

/**
 * The swipe round's cards: the dinners that could work on at least one
 * open night this week, best first, plus a couple the family has never
 * made so something new gets a shot. Shuffled with a seed so everyone who
 * swipes this week sees the same cards in the same order.
 */
export function buildDeck(
  nights: EngineNight[],
  context: EngineContext,
  chosen: Chosen[],
  options: { size?: number; newOnes?: number; seed?: number } = {},
): string[] {
  const size = options.size ?? 12;
  const newOnes = options.newOnes ?? 2;
  // Ignore this week's vetoes and votes: the deck shouldn't reshuffle while
  // people are swiping, and a vetoed card should still show as vetoed.
  const neutral: EngineContext = {
    ...context,
    vetoes: [],
    members: context.members.map((m) => ({ ...m, votes: {} })),
  };
  const best = new Map<string, number>();
  for (const night of nights) {
    for (const scored of rankForNight({ ...night, favoredMemberId: null }, neutral, chosen)) {
      if (scored.excluded) continue;
      best.set(scored.recipeId, Math.max(best.get(scored.recipeId) ?? -Infinity, scored.score));
    }
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const neverMade = new Set(context.recipes.filter((r) => !r.lastCooked).map((r) => r.id));

  const fresh = ranked.filter((id) => neverMade.has(id)).slice(0, newOnes);
  const deck = [...fresh];
  for (const id of ranked) {
    if (deck.length >= size) break;
    if (!deck.includes(id)) deck.push(id);
  }

  const random = seededRandom(options.seed ?? 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** A stable number from a string, for seeding. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Tally = { recipeId: string; loves: number; yeses: number; nopes: number; score: number; vetoedBy: string[] };

/** Adds up the swipe votes so the results screen can show the winners. */
export function tallyVotes(
  deck: string[],
  votes: { memberId: string; recipeId: string; vote: number }[],
  vetoes: { memberId: string; recipeId: string }[],
): Tally[] {
  return deck
    .map((recipeId) => {
      const mine = votes.filter((v) => v.recipeId === recipeId);
      const loves = mine.filter((v) => v.vote >= 2).length;
      const yeses = mine.filter((v) => v.vote === 1).length;
      const nopes = mine.filter((v) => v.vote < 0).length;
      const score = mine.reduce((sum, v) => sum + (v.vote < 0 ? -1.5 : v.vote), 0);
      const vetoedBy = vetoes.filter((v) => v.recipeId === recipeId).map((v) => v.memberId);
      return { recipeId, loves, yeses, nopes, score, vetoedBy };
    })
    .sort((a, b) => Number(a.vetoedBy.length > 0) - Number(b.vetoedBy.length > 0) || b.score - a.score);
}
