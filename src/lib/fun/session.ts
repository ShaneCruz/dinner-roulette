import { inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { recipe } from "@/db/schema";
import { loadEngineInputs } from "@/lib/suggest/load";
import { buildDeck, seedFrom, tallyVotes } from "./deck";
import { loadHands, weekVetoes } from "./cards";
import { weekVotes } from "./votes";

export type SessionCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string;
  activeMinutes: number;
  totalMinutes: number;
  spiceLevel: number;
  healthCategory: "healthy" | "balanced" | "comfort";
  isNew: boolean;
  calories: number | null;
  proteinG: number | null;
};

/**
 * Everything the Sunday session needs for one week: the open nights, the
 * swipe deck, votes so far, vetoes and each person's cards.
 */
export async function loadSession(db: Database, weekStart: string, today: string) {
  const inputs = await loadEngineInputs(db, weekStart, { weather: false });
  const open = inputs.nights.filter(
    (n) =>
      n.date >= today &&
      n.nightType === "cook" &&
      n.status !== "cooked" &&
      n.status !== "skipped" &&
      (!n.recipeId || (n.suggested && n.status === "planned")),
  );
  const openDates = new Set(open.map((n) => n.date));
  const kept = inputs.chosen.filter((c) => !openDates.has(c.date));

  const [votes, vetoes, hands] = await Promise.all([
    weekVotes(db, weekStart),
    weekVetoes(db, weekStart),
    loadHands(db, weekStart),
  ]);

  const deck = open.length ? buildDeck(open, inputs.context, kept, { seed: seedFrom(weekStart) }) : [];
  // Keep cards people already voted on, even if the plan changed since.
  for (const v of [...votes, ...vetoes]) if (!deck.includes(v.recipeId)) deck.push(v.recipeId);

  const rows = deck.length ? await db.select().from(recipe).where(inArray(recipe.id, deck)) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const engineById = new Map(inputs.context.recipes.map((r) => [r.id, r]));
  const cards: SessionCard[] = deck
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      activeMinutes: r.activeMinutes,
      totalMinutes: r.totalMinutes,
      spiceLevel: r.spiceLevel,
      healthCategory: r.healthCategory,
      isNew: !engineById.get(r.id)?.lastCooked,
      calories: r.nutrition?.calories ?? null,
      proteinG: r.nutrition?.proteinG ?? null,
    }));

  const eatingIds = new Set(open.flatMap((n) => n.eaterIds));
  return {
    openNights: open.map((n) => n.date),
    eatingIds,
    cards,
    votes,
    vetoes,
    hands,
    tally: tallyVotes(cards.map((c) => c.id), votes, vetoes),
  };
}
