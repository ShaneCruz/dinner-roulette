import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { cardUse, plannedMeal, rating, recipe, sessionVote, wheelSpin } from "@/db/schema";
import { addDays } from "@/lib/presence";
import { weekStartFor } from "@/lib/plan/week";

/**
 * Badges and streaks, worked out from what the family already does:
 * ratings (including ones a parent entered for a kid), swipes, spins and
 * cards. Nothing to store, so they can't get out of sync.
 */

export type BadgeStats = {
  ratings: number;
  distinctRated: number;
  withReasons: number;
  fiveStars: number;
  oneStars: number;
  spicyLoved: number;
  votes: number;
  spins: number;
  chaos: number;
  vetoes: number;
  chefsPicks: number;
  turns: number;
  /** Weeks in a row (ending this week or last) with at least one rating */
  streak: number;
};

export type Badge = {
  id: string;
  emoji: string;
  name: string;
  how: string;
  earned: boolean;
  /** 0..1 toward earning it */
  progress: number;
  label?: string;
};

type Def = { id: string; emoji: string; name: string; how: string; value: (s: BadgeStats) => number; goal: number };

const DEFS: Def[] = [
  { id: "first-bite", emoji: "🍴", name: "First Bite", how: "Rate your first dinner", value: (s) => s.ratings, goal: 1 },
  { id: "critic", emoji: "📝", name: "Food Critic", how: "Rate 10 dinners", value: (s) => s.ratings, goal: 10 },
  { id: "head-judge", emoji: "🏆", name: "Head Judge", how: "Rate 25 dinners", value: (s) => s.ratings, goal: 25 },
  { id: "says-why", emoji: "💬", name: "Says Why", how: "Give reasons on 5 ratings", value: (s) => s.withReasons, goal: 5 },
  { id: "adventurous", emoji: "🧭", name: "Adventurous Eater", how: "Rate 8 different dinners", value: (s) => s.distinctRated, goal: 8 },
  { id: "spice", emoji: "🌶️", name: "Spice Explorer", how: "Give 4+ stars to a spicy dinner", value: (s) => s.spicyLoved, goal: 1 },
  { id: "honest", emoji: "🧊", name: "Brutally Honest", how: "Give a dinner 1 star", value: (s) => s.oneStars, goal: 1 },
  { id: "chefs-kiss", emoji: "🤌", name: "Chef's Kiss", how: "Give 5 stars 5 times", value: (s) => s.fiveStars, goal: 5 },
  { id: "on-a-roll", emoji: "🔥", name: "On a Roll", how: "Rate dinners 3 weeks in a row", value: (s) => s.streak, goal: 3 },
  { id: "swiper", emoji: "🗳️", name: "Swipe Machine", how: "Vote on 25 cards in swipe rounds", value: (s) => s.votes, goal: 25 },
  { id: "spinner", emoji: "🎡", name: "Wheel Spinner", how: "Spin the dinner wheel 5 times", value: (s) => s.spins, goal: 5 },
  { id: "chaos", emoji: "🎲", name: "Agent of Chaos", how: "Land on the chaos slice", value: (s) => s.chaos, goal: 1 },
  { id: "veto", emoji: "🚫", name: "Veto Villain", how: "Play a veto card", value: (s) => s.vetoes, goal: 1 },
  { id: "chefs-pick", emoji: "👨‍🍳", name: "Head Chef", how: "Play a Chef's Pick", value: (s) => s.chefsPicks, goal: 1 },
  { id: "captain", emoji: "🧑‍✈️", name: "Dinner Captain", how: "Have your pick cooked 10 times", value: (s) => s.turns, goal: 10 },
];

export function computeBadges(stats: BadgeStats): Badge[] {
  return DEFS.map((d) => {
    const value = d.value(stats);
    return {
      id: d.id,
      emoji: d.emoji,
      name: d.name,
      how: d.how,
      earned: value >= d.goal,
      progress: Math.min(1, value / d.goal),
      label: d.goal > 1 ? `${Math.min(value, d.goal)}/${d.goal}` : undefined,
    };
  });
}

/** Consecutive weeks with a rating, counting back from this week (or last week, so Monday doesn't break it). */
export function ratingStreak(ratingDates: string[], today: string, weekStartsOn: number): number {
  const weeks = new Set(ratingDates.map((d) => weekStartFor(d, weekStartsOn)));
  let week = weekStartFor(today, weekStartsOn);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export const EMPTY_STATS: BadgeStats = {
  ratings: 0, distinctRated: 0, withReasons: 0, fiveStars: 0, oneStars: 0, spicyLoved: 0,
  votes: 0, spins: 0, chaos: 0, vetoes: 0, chefsPicks: 0, turns: 0, streak: 0,
};

export async function loadBadgeStats(
  db: Database,
  memberIds: string[],
  today: string,
  weekStartsOn: number,
): Promise<Map<string, BadgeStats>> {
  const out = new Map(memberIds.map((id) => [id, { ...EMPTY_STATS }]));
  if (!memberIds.length) return out;
  const [ratings, votes, spins, cards, turns] = await Promise.all([
    db
      .select({
        memberId: rating.memberId,
        recipeId: rating.recipeId,
        stars: rating.stars,
        reasons: rating.reasons,
        note: rating.note,
        date: plannedMeal.date,
        spice: recipe.spiceLevel,
      })
      .from(rating)
      .innerJoin(plannedMeal, eq(plannedMeal.id, rating.plannedMealId))
      .innerJoin(recipe, eq(recipe.id, rating.recipeId))
      .where(inArray(rating.memberId, memberIds)),
    db
      .select({ memberId: sessionVote.memberId, n: sql<number>`count(*)::int` })
      .from(sessionVote)
      .where(inArray(sessionVote.memberId, memberIds))
      .groupBy(sessionVote.memberId),
    db
      .select({ memberId: wheelSpin.spunByMemberId, chaos: wheelSpin.chaos })
      .from(wheelSpin)
      .where(and(isNotNull(wheelSpin.spunByMemberId), inArray(wheelSpin.spunByMemberId, memberIds))),
    db
      .select({ memberId: cardUse.memberId, card: cardUse.card })
      .from(cardUse)
      .where(inArray(cardUse.memberId, memberIds)),
    db
      .select({ memberId: plannedMeal.favoredMemberId, n: sql<number>`count(*)::int` })
      .from(plannedMeal)
      .where(and(eq(plannedMeal.status, "cooked"), inArray(plannedMeal.favoredMemberId, memberIds)))
      .groupBy(plannedMeal.favoredMemberId),
  ]);

  for (const id of memberIds) {
    const s = out.get(id)!;
    const mine = ratings.filter((r) => r.memberId === id);
    s.ratings = mine.length;
    s.distinctRated = new Set(mine.map((r) => r.recipeId)).size;
    s.withReasons = mine.filter((r) => r.reasons.length > 0 || Boolean(r.note?.trim())).length;
    s.fiveStars = mine.filter((r) => r.stars === 5).length;
    s.oneStars = mine.filter((r) => r.stars === 1).length;
    s.spicyLoved = mine.filter((r) => r.spice >= 2 && r.stars >= 4).length;
    s.streak = ratingStreak(mine.map((r) => r.date), today, weekStartsOn);
    s.votes = votes.find((v) => v.memberId === id)?.n ?? 0;
    s.spins = spins.filter((x) => x.memberId === id).length;
    s.chaos = spins.filter((x) => x.memberId === id && x.chaos).length;
    s.vetoes = cards.filter((c) => c.memberId === id && c.card === "veto").length;
    s.chefsPicks = cards.filter((c) => c.memberId === id && c.card === "chefs_pick").length;
    s.turns = turns.find((t) => t.memberId === id)?.n ?? 0;
  }
  return out;
}
