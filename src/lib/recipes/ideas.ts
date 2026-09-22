import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { recipe, recipeIdea } from "@/db/schema";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { suggestDinnerIdeas, writeIdeaRecipe } from "@/lib/ai/ideas";
import { ensureNutrition } from "@/lib/nutrition-store";
import { season } from "@/lib/suggest/engine";
import { saveRecipe, slugify, uniqueSlug } from "./store";

export type IdeaRow = typeof recipeIdea.$inferSelect;

export async function pendingIdeas(db: Database): Promise<IdeaRow[]> {
  return db.select().from(recipeIdea).where(eq(recipeIdea.status, "pending")).orderBy(asc(recipeIdea.createdAt));
}

export async function recentAdditions(db: Database, limit = 12) {
  return db
    .select({ id: recipeIdea.id, title: recipeIdea.title, emoji: recipeIdea.emoji, status: recipeIdea.status, slug: recipe.slug })
    .from(recipeIdea)
    .leftJoin(recipe, eq(recipe.id, recipeIdea.recipeId))
    .where(inArray(recipeIdea.status, ["writing", "added", "failed"]))
    .orderBy(desc(recipeIdea.updatedAt))
    .limit(limit);
}

/** Deals a fresh batch of ideas. */
export async function dealIdeas(db: Database, today: string, count = 8): Promise<number> {
  const [have, past] = await Promise.all([
    db.select({ title: recipe.title }).from(recipe).where(eq(recipe.kind, "main")),
    db.select({ title: recipeIdea.title, status: recipeIdea.status }).from(recipeIdea).orderBy(desc(recipeIdea.createdAt)).limit(200),
  ]);
  const brief = await loadFamilyBrief(db);
  const ideas = await suggestDinnerIdeas(
    brief,
    {
      have: have.map((h) => h.title),
      rejected: past.filter((p) => p.status === "rejected").map((p) => p.title).slice(0, 80),
      accepted: past.filter((p) => p.status === "added" || p.status === "writing").map((p) => p.title).slice(0, 40),
    },
    season(today),
    count,
  );
  if (!ideas.length) return 0;
  await db.insert(recipeIdea).values(
    ideas.map((i) => ({
      title: i.title.trim().slice(0, 100),
      description: i.description.trim(),
      emoji: i.emoji.trim().slice(0, 8) || "🍽️",
      cuisine: i.cuisine.trim() || "American",
      activeMinutes: Math.max(1, Math.round(i.activeMinutes)),
      totalMinutes: Math.max(Math.round(i.totalMinutes), Math.round(i.activeMinutes), 1),
      healthCategory: i.healthCategory,
      spiceLevel: Math.min(Math.max(Math.round(i.spiceLevel), 0), 3),
      kidAppeal: i.kidAppeal.trim() || null,
      twistOn: i.twistOn?.trim() || null,
    })),
  );
  return ideas.length;
}

export async function decideIdea(db: Database, id: string, yes: boolean, memberId: string): Promise<boolean> {
  const updated = await db
    .update(recipeIdea)
    .set({ status: yes ? "writing" : "rejected", decidedByMemberId: memberId })
    .where(and(eq(recipeIdea.id, id), eq(recipeIdea.status, "pending")))
    .returning({ id: recipeIdea.id });
  return updated.length > 0;
}

/** Writes the recipe for an accepted idea and adds it to the family's recipes. */
export async function writeAcceptedIdea(db: Database, id: string): Promise<void> {
  const [idea] = await db.select().from(recipeIdea).where(eq(recipeIdea.id, id));
  if (!idea || idea.status !== "writing") return;
  try {
    const brief = await loadFamilyBrief(db);
    const written = await writeIdeaRecipe(idea, brief);
    if (!written) throw new Error("No recipe came back.");
    const slug = await uniqueSlug(db, slugify(written.recipe.title));
    const recipeId = await saveRecipe(db, { ...written.recipe, slug }, {
      source: "ai",
      status: "approved",
      notes: [`Added from Discover.${idea.kidAppeal ? ` ${idea.kidAppeal}` : ""}`, written.notes].filter(Boolean).join("\n\n"),
      createdByMemberId: idea.decidedByMemberId,
    });
    await db.update(recipeIdea).set({ status: "added", recipeId, error: null }).where(eq(recipeIdea.id, id));
    await ensureNutrition(db, recipeId).catch((error) => console.error("Nutrition estimate failed", error));
  } catch (error) {
    console.error("Writing an idea failed", error);
    await db
      .update(recipeIdea)
      // A second failure is final, so the scheduler stops retrying.
      .set({ status: "failed", error: idea.error === "retrying" ? "gave up" : error instanceof Error ? error.message.slice(0, 200) : "Failed" })
      .where(eq(recipeIdea.id, id));
  }
}

/** For the scheduler: finishes ideas whose writing got cut off, and retries failures once. */
export async function finishStuckIdeas(db: Database, now: Date, limit = 3): Promise<number> {
  const stuck = await db
    .select({ id: recipeIdea.id, status: recipeIdea.status, error: recipeIdea.error })
    .from(recipeIdea)
    .where(and(inArray(recipeIdea.status, ["writing", "failed"]), lt(recipeIdea.updatedAt, new Date(now.getTime() - 10 * 60_000)), isNull(recipeIdea.recipeId)))
    .limit(limit * 3);
  const retry = stuck.filter((i) => i.status === "writing" || i.error !== "gave up").slice(0, limit);
  for (const idea of retry) {
    if (idea.status === "failed") {
      await db.update(recipeIdea).set({ status: "writing", error: "retrying" }).where(eq(recipeIdea.id, idea.id));
    }
    await writeAcceptedIdea(db, idea.id);
  }
  return retry.length;
}
