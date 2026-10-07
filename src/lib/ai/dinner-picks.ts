import "server-only";
import { and, eq, gte, isNull, lte, max } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { familySettings, plannedMeal, recipe } from "@/db/schema";
import { addDays, daysBetween } from "@/lib/presence";
import { averageRatings } from "@/lib/ratings/store";
import { COOK_METHOD_LABELS, type CookMethod } from "@/lib/recipes/schema";
import { formatDay } from "@/lib/plan/week";
import { structured } from "./claude";
import { describeFamily, type FamilyBrief } from "./recipes";

/** One dinner in the recipe box, with what matters for choosing it tonight. */
export type DinnerCandidate = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  method: CookMethod;
  tags: string[];
  activeMinutes: number;
  totalMinutes: number;
  spiceLevel: number;
  healthCategory: string;
  /** Last night it was made, if ever */
  lastCooked: string | null;
  /** Another night this week it's already planned for */
  plannedOn: string | null;
  /** The family's average stars, 1-5, if anyone rated it */
  familyStars: number | null;
  /** Its own cooldown, or the family's default */
  cooldownDays: number;
};

/** Every dinner in the box (drafts too: plenty of imports stay drafts), with its history. */
export async function loadDinnerCandidates(db: Database, today: string): Promise<DinnerCandidate[]> {
  const [[settings], rows, cooked, planned, ratings] = await Promise.all([
    db.select({ cooldown: familySettings.defaultCooldownDays }).from(familySettings).limit(1),
    db.select().from(recipe).where(and(eq(recipe.kind, "main"), isNull(recipe.archivedAt))),
    db
      .select({ recipeId: plannedMeal.recipeId, last: max(plannedMeal.date) })
      .from(plannedMeal)
      .where(and(eq(plannedMeal.status, "cooked"), lte(plannedMeal.date, today)))
      .groupBy(plannedMeal.recipeId),
    db
      .select({ recipeId: plannedMeal.recipeId, date: plannedMeal.date })
      .from(plannedMeal)
      .where(
        and(
          eq(plannedMeal.status, "planned"),
          eq(plannedMeal.nightType, "cook"),
          gte(plannedMeal.date, addDays(today, -3)),
          lte(plannedMeal.date, addDays(today, 7)),
        ),
      ),
    averageRatings(db),
  ]);
  const lastCooked = new Map(cooked.map((c) => [c.recipeId, c.last]));
  const stars = new Map<string, number[]>();
  for (const byRecipe of ratings.values()) {
    for (const [id, value] of Object.entries(byRecipe)) stars.set(id, [...(stars.get(id) ?? []), value]);
  }
  return rows.map((r) => {
    const mine = stars.get(r.id);
    // Tonight's own dinner doesn't count as "already planned": she may be replacing it.
    const elsewhere = planned.filter((p) => p.recipeId === r.id && p.date !== today).map((p) => p.date).sort();
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      method: r.method as CookMethod,
      tags: r.tags,
      activeMinutes: r.activeMinutes,
      totalMinutes: r.totalMinutes,
      spiceLevel: r.spiceLevel,
      healthCategory: r.healthCategory,
      lastCooked: lastCooked.get(r.id) ?? null,
      plannedOn: elsewhere[0] ?? null,
      familyStars: mine ? Math.round((mine.reduce((a, b) => a + b, 0) / mine.length) * 10) / 10 : null,
      cooldownDays: r.cooldownDays ?? settings?.cooldown ?? 14,
    };
  });
}

/** The recipe box as a compact table, one dinner per line, for Claude to choose from. */
export function describeCandidates(candidates: DinnerCandidate[], today: string): string {
  return candidates
    .map((c) => {
      const ago = c.lastCooked ? daysBetween(c.lastCooked, today) : null;
      const history =
        ago === null
          ? "never made"
          : `made ${ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}${ago < c.cooldownDays ? " (TOO RECENT)" : ""}`;
      return [
        c.slug,
        c.title,
        c.cuisine,
        COOK_METHOD_LABELS[c.method],
        `${c.activeMinutes} min hands-on, ${c.totalMinutes} min total`,
        c.healthCategory,
        c.spiceLevel ? `spice ${c.spiceLevel}/3` : "no heat",
        c.tags.length ? `tags: ${c.tags.join(", ")}` : "",
        history,
        c.plannedOn ? `already planned ${formatDay(c.plannedOn)}` : "",
        c.familyStars !== null ? `family rates it ${c.familyStars}/5` : "",
        c.description.slice(0, 140),
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}

const picksSchema = z.object({
  picks: z
    .array(
      z.object({
        slug: z.string().describe("Exactly as in the list"),
        why: z.string().describe("One short sentence tying it to what they asked for"),
        tip: z.string().nullable().describe("A practical timing note when it matters, e.g. 'Start it by 10am', else null"),
      }),
    )
    .describe("3 to 5 dinners from the list, best first"),
  note: z.string().nullable().describe("Only if nothing fits well: say so in one friendly sentence, and what's closest"),
});

export type DinnerPick = { slug: string; why: string; tip: string | null };

/**
 * Picks dinners from the family's own recipe box for what tonight looks
 * like: "I'm home this morning, slow cooker?", "soccer until 6, super easy",
 * "anything but pasta", "Dad wants to grill".
 */
export async function recommendDinners(
  request: string,
  candidates: DinnerCandidate[],
  today: string,
  brief: FamilyBrief,
  dinnerTime: string,
): Promise<{ picks: DinnerPick[]; note: string | null }> {
  const result = await structured({
    feature: "dinner ideas",
    tier: "balanced",
    effort: "low",
    maxTokens: 4000,
    system: `You help a family pick tonight's dinner from their own recipe box. A parent tells you what tonight looks like (time, energy, mood, cravings, equipment, someone wanting to grill) and you recommend 3 to 5 dinners from the list, best first.

How to choose:
- Read the request literally and honor every constraint. "Slow cooker" or "home this morning" means long total time is fine, even ideal, as long as the hands-on part can happen early; a busy evening means very little hands-on time at dinner and nothing fussy, so a slow cooker or make-ahead dinner started earlier in the day is often the best answer (say when to start it). "Sick of pasta" means no pasta at all. "Grill" means grill recipes.
- Avoid dinners marked TOO RECENT or already planned on another night, unless they ask for that dish by name or nothing else fits; then say so in "why".
- Among dinners that fit, prefer ones the family rates highly and ones they haven't had in a while. Mix it up: don't recommend three of the same cuisine or protein unless asked.
- Only recommend dinners from the list. Never invent one, and never suggest cooking one a different way than its method (an oven dish is not a slow cooker dish) unless its own description says it can be.
- "why" is one short, warm sentence about why it suits tonight specifically (not a description of the dish). "tip" is for timing that matters, worked out back from dinner time ("Start it by 10am"), otherwise null.
- If fewer than 3 fit well, return what fits and use "note" to say so honestly. Otherwise "note" is null.

About the family:
${describeFamily(brief)}`,
    content: `Today is ${formatDay(today, "long")}. Dinner is usually at ${dinnerTime}.

What tonight looks like: ${request}

Their dinners (slug | title | cuisine | method | time | health | heat | tags | history | rating | description):
${describeCandidates(candidates, today)}`,
    schema: picksSchema,
  });

  const known = new Set(candidates.map((c) => c.slug));
  const seen = new Set<string>();
  const picks = result.picks
    .map((p) => ({ slug: p.slug.trim(), why: p.why.trim(), tip: p.tip?.trim() || null }))
    .filter((p) => known.has(p.slug) && !seen.has(p.slug) && seen.add(p.slug))
    .slice(0, 5);
  // A note is for when little fits; with a full list it's just noise.
  return { picks, note: picks.length < 3 ? result.note?.trim() || null : null };
}
