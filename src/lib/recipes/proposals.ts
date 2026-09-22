import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, notInArray } from "drizzle-orm";
import type { Database } from "@/db";
import { member, plannedMeal, rating, recipe, recipeProposal, recipeRevision } from "@/db/schema";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { aiEnabled } from "@/lib/ai/claude";
import { reviseRecipe, type Feedback } from "@/lib/ai/revise";
import { REASONS } from "@/lib/ratings/scale";
import { getRecipe, saveRecipe } from "./store";
import type { Recipe } from "./schema";

/**
 * Recipes that learn: ratings with complaints (or a parent's request) turn
 * into a suggested revision that a parent accepts or dismisses. Accepting
 * keeps the old version so it can be undone.
 */

const NEGATIVE = new Set<string>(REASONS.filter((r) => !r.positive).map((r) => r.id));

/** Does this rating point to something worth fixing? */
export function isCritical(r: { stars: number; reasons: string[]; note: string | null }): boolean {
  return r.stars <= 2 || r.reasons.some((id) => NEGATIVE.has(id)) || (r.stars <= 3 && Boolean(r.note?.trim()));
}

function label(id: string) {
  const reason = REASONS.find((r) => r.id === id);
  return reason ? reason.label.toLowerCase() : id;
}

const SPICE = ["no heat at all", "mild", "medium", "very spicy"];

async function loadFeedback(db: Database, recipeId: string) {
  const rows = await db
    .select({
      id: rating.id,
      stars: rating.stars,
      reasons: rating.reasons,
      note: rating.note,
      date: plannedMeal.date,
      role: member.role,
      birthYear: member.birthYear,
      spice: member.spiceTolerance,
    })
    .from(rating)
    .innerJoin(plannedMeal, eq(plannedMeal.id, rating.plannedMealId))
    .innerJoin(member, eq(member.id, rating.memberId))
    .where(eq(rating.recipeId, recipeId))
    .orderBy(desc(plannedMeal.date))
    .limit(30);
  const year = new Date().getFullYear();
  const feedback: Feedback[] = rows.map((r) => ({
    who: `${r.role === "kid" ? `a kid${r.birthYear ? ` (about ${year - r.birthYear})` : ""}` : "a parent"} who likes ${SPICE[r.spice] ?? "mild"} food`,
    stars: r.stars,
    reasons: r.reasons.map(label),
    note: r.note,
    date: r.date,
  }));
  return { rows, feedback };
}

export type ProposalRow = typeof recipeProposal.$inferSelect;

export async function pendingProposal(db: Database, recipeId: string): Promise<ProposalRow | null> {
  const [row] = await db
    .select()
    .from(recipeProposal)
    .where(and(eq(recipeProposal.recipeId, recipeId), eq(recipeProposal.status, "pending")))
    .orderBy(desc(recipeProposal.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listPendingProposals(db: Database) {
  return db
    .select({ id: recipeProposal.id, summary: recipeProposal.summary, slug: recipe.slug, title: recipe.title })
    .from(recipeProposal)
    .innerJoin(recipe, eq(recipe.id, recipeProposal.recipeId))
    .where(and(eq(recipeProposal.status, "pending"), isNull(recipe.archivedAt)))
    .orderBy(desc(recipeProposal.createdAt));
}

/**
 * Asks Claude for a revision. From ratings, it only proposes when there's
 * new critical feedback; a parent's request always gets an answer.
 */
export async function createProposal(
  db: Database,
  recipeId: string,
  options: { request?: string | null; memberId?: string | null } = {},
): Promise<{ created: true; id: string } | { created: false; reason: string }> {
  if (!aiEnabled()) return { created: false, reason: "AI isn't set up." };
  const current = await getRecipe(db, { id: recipeId });
  if (!current) return { created: false, reason: "That recipe is gone." };
  const request = options.request?.trim() || null;
  const { rows, feedback } = await loadFeedback(db, recipeId);

  if (!request) {
    // Only ratings nobody has looked at in a proposal yet.
    const earlier = await db
      .select({ ids: recipeProposal.basedOnRatingIds })
      .from(recipeProposal)
      .where(eq(recipeProposal.recipeId, recipeId));
    const seen = new Set(earlier.flatMap((p) => p.ids));
    const fresh = rows.filter((r) => !seen.has(r.id) && isCritical(r));
    if (!fresh.length) return { created: false, reason: "No new complaints to work on." };
  }

  const brief = await loadFamilyBrief(db);
  const revised = await reviseRecipe(current, feedback, request, brief);
  if (!revised) {
    // Remember we looked, so the same ratings don't trigger it again.
    await db.insert(recipeProposal).values({
      recipeId,
      trigger: request ? "request" : "ratings",
      request,
      summary: "Looked at the ratings; nothing worth changing.",
      proposed: current,
      basedOnRatingIds: rows.map((r) => r.id),
      status: "dismissed",
      decidedAt: new Date(),
    });
    return { created: false, reason: request ? "Claude didn't think that needed a change. Try describing it differently." : "Nothing worth changing." };
  }

  // A newer proposal replaces an older pending one.
  await db
    .update(recipeProposal)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(and(eq(recipeProposal.recipeId, recipeId), eq(recipeProposal.status, "pending")));
  const [created] = await db
    .insert(recipeProposal)
    .values({
      recipeId,
      trigger: request ? "request" : "ratings",
      request,
      summary: revised.summary,
      changes: revised.changes,
      proposed: revised.recipe,
      basedOnRatingIds: rows.map((r) => r.id),
      createdByMemberId: options.memberId ?? null,
    })
    .returning({ id: recipeProposal.id });
  return { created: true, id: created.id };
}

function stripStored(r: NonNullable<Awaited<ReturnType<typeof getRecipe>>>): Recipe {
  return {
    slug: r.slug, title: r.title, description: r.description, kind: r.kind, cuisine: r.cuisine, tags: r.tags,
    method: r.method, activeMinutes: r.activeMinutes, totalMinutes: r.totalMinutes, baseServings: r.baseServings,
    spiceLevel: r.spiceLevel, spiceSplit: r.spiceSplit, seasonFit: r.seasonFit, indoorMethod: r.indoorMethod,
    healthCategory: r.healthCategory, cooldownDays: r.cooldownDays, ingredients: r.ingredients, steps: r.steps,
    variants: r.variants, pairsWith: r.pairsWith,
  };
}

export async function acceptProposal(db: Database, proposalId: string): Promise<string | null> {
  const [proposal] = await db.select().from(recipeProposal).where(eq(recipeProposal.id, proposalId));
  if (!proposal || proposal.status !== "pending") return null;
  const current = await getRecipe(db, { id: proposal.recipeId });
  if (!current) return null;
  await db.insert(recipeRevision).values({ recipeId: current.id, snapshot: stripStored(current), reason: proposal.summary });
  await saveRecipe(
    db,
    { ...proposal.proposed, slug: current.slug },
    {
      source: current.source === "starter" ? "manual" : current.source,
      sourceUrl: current.sourceUrl,
      status: current.status,
      notes: current.notes,
    },
    current.id,
  );
  await db.update(recipeProposal).set({ status: "accepted", decidedAt: new Date() }).where(eq(recipeProposal.id, proposalId));
  return current.id;
}

export async function dismissProposal(db: Database, proposalId: string) {
  await db
    .update(recipeProposal)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(and(eq(recipeProposal.id, proposalId), eq(recipeProposal.status, "pending")));
}

export async function latestRevision(db: Database, recipeId: string) {
  const [row] = await db
    .select()
    .from(recipeRevision)
    .where(eq(recipeRevision.recipeId, recipeId))
    .orderBy(desc(recipeRevision.createdAt))
    .limit(1);
  return row ?? null;
}

/** Puts the recipe back the way it was before the last accepted change. */
export async function undoLastChange(db: Database, recipeId: string): Promise<boolean> {
  const revision = await latestRevision(db, recipeId);
  const current = await getRecipe(db, { id: recipeId });
  if (!revision || !current) return false;
  await saveRecipe(
    db,
    { ...revision.snapshot, slug: current.slug },
    { source: current.source, sourceUrl: current.sourceUrl, status: current.status, notes: current.notes },
    recipeId,
  );
  await db.delete(recipeRevision).where(eq(recipeRevision.id, revision.id));
  return true;
}

/**
 * For the scheduler: finds recipes with new critical ratings from the last
 * few weeks and drafts a revision for a couple of them.
 */
export async function scanForProposals(db: Database, since: Date, settledBefore: Date, limit = 2): Promise<number> {
  if (!aiEnabled()) return 0;
  const recent = await db
    .select({ id: rating.id, recipeId: rating.recipeId, stars: rating.stars, reasons: rating.reasons, note: rating.note })
    .from(rating)
    // Wait until ratings settle, so everyone's votes on a dinner are read together.
    .where(and(gt(rating.updatedAt, since), lt(rating.updatedAt, settledBefore)));
  const candidates = [...new Set(recent.filter(isCritical).map((r) => r.recipeId))];
  if (!candidates.length) return 0;
  const busy = await db
    .select({ recipeId: recipeProposal.recipeId })
    .from(recipeProposal)
    .where(and(eq(recipeProposal.status, "pending"), inArray(recipeProposal.recipeId, candidates)));
  const open = candidates.filter((id) => !busy.some((b) => b.recipeId === id));
  const live = open.length
    ? await db.select({ id: recipe.id }).from(recipe).where(and(inArray(recipe.id, open), isNull(recipe.archivedAt), notInArray(recipe.status, ["draft"])))
    : [];
  let made = 0;
  for (const r of live.slice(0, limit)) {
    const result = await createProposal(db, r.id);
    if (result.created) made++;
  }
  return made;
}
