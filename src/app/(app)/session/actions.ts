"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { member, recipe } from "@/db/schema";
import { grantCard, playCard, undoVeto } from "@/lib/fun/cards";
import { castVote, clearVotes, VOTE } from "@/lib/fun/votes";
import { loadMeals, regenerateGroceryList, saveNight } from "@/lib/plan/store";
import { weekDates, weekStartFor } from "@/lib/plan/week";
import { addDays, todayIn } from "@/lib/presence";
import { requireActingMember, requireParentMember } from "@/lib/session";
import { applySuggestions } from "@/lib/suggest/apply";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type Result = { error: string } | { ok: true };

/** Kids act for themselves; parents can act for anyone (pass-the-phone, or on a kid's behalf). */
async function actFor(memberId: string, weekStart: string) {
  const context = await requireActingMember();
  if (!z.uuid().safeParse(memberId).success || !dateSchema.safeParse(weekStart).success) return null;
  if (weekStartFor(weekStart, context.settings.weekStartsOn) !== weekStart) return null;
  if (context.acting.role !== "parent" && context.acting.id !== memberId) return null;
  const [who] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), isNull(member.archivedAt)));
  return who ? { ...context, who } : null;
}

export async function voteAction(
  weekStart: string,
  memberId: string,
  recipeId: string,
  vote: "nope" | "yes" | "love" | "doubled",
): Promise<Result> {
  const context = await actFor(memberId, weekStart);
  if (!context || !z.uuid().safeParse(recipeId).success || !(vote in VOTE)) return { error: "That vote didn't count. Try again." };
  if (vote === "doubled" && !(await playCard(db, memberId, "double_down", weekStart, recipeId))) {
    return { error: "No Double Down card to play." };
  }
  await castVote(db, weekStart, memberId, recipeId, VOTE[vote]);
  return { ok: true };
}

export async function vetoAction(weekStart: string, memberId: string, recipeId: string): Promise<Result> {
  const context = await actFor(memberId, weekStart);
  if (!context || !z.uuid().safeParse(recipeId).success) return { error: "That veto didn't work. Try again." };
  if (!(await playCard(db, memberId, "veto", weekStart, recipeId))) {
    return { error: `${context.who.name} already used this week's veto.` };
  }
  await castVote(db, weekStart, memberId, recipeId, VOTE.nope);
  revalidatePath("/session");
  return { ok: true };
}

export async function undoVetoAction(weekStart: string, memberId: string, recipeId: string) {
  await requireParentMember();
  if (!dateSchema.safeParse(weekStart).success || !z.uuid().safeParse(memberId).success || !z.uuid().safeParse(recipeId).success) return;
  await undoVeto(db, memberId, weekStart, recipeId);
  revalidatePath("/session");
}

export async function startOverAction(weekStart: string, memberId: string): Promise<Result> {
  const context = await actFor(memberId, weekStart);
  if (!context) return { error: "Couldn't reset those votes." };
  await clearVotes(db, weekStart, memberId);
  revalidatePath("/session");
  return { ok: true };
}

/** Re-plans the week's open (and engine-picked) nights using everyone's votes. */
export async function buildWeekAction(weekStart: string): Promise<{ error: string } | { filled: number }> {
  const { settings } = await requireParentMember();
  if (!dateSchema.safeParse(weekStart).success) return { error: "Unknown week." };
  const filled = await applySuggestions(db, weekStart, todayIn(settings.timezone), settings.weekStartsOn, {
    replaceSuggested: true,
  });
  revalidatePath("/", "layout");
  return { filled };
}

const cardSchema = z.enum(["double_down", "respin", "chefs_pick"]);

export async function giveCardAction(memberId: string, card: string, reason: string): Promise<Result> {
  const { acting } = await requireParentMember();
  const parsedCard = cardSchema.safeParse(card);
  if (!z.uuid().safeParse(memberId).success || !parsedCard.success) return { error: "Pick a person and a card." };
  await grantCard(db, memberId, parsedCard.data, { reason: reason.trim().slice(0, 120) || null, grantedBy: acting.id });
  revalidatePath("/session");
  return { ok: true };
}

export async function chefsPickAction(memberId: string, date: string, recipeId: string): Promise<Result> {
  const { settings, acting } = await requireActingMember();
  if (!z.uuid().safeParse(memberId).success || !dateSchema.safeParse(date).success || !z.uuid().safeParse(recipeId).success) {
    return { error: "Pick a night and a dinner." };
  }
  if (acting.role !== "parent" && acting.id !== memberId) return { error: "You can only play your own cards." };
  const today = todayIn(settings.timezone);
  const weekStart = weekStartFor(date, settings.weekStartsOn);
  // Tonight through the end of next week.
  const lastDay = weekDates(weekStartFor(today, settings.weekStartsOn))[6];
  if (date < today || date > addDays(lastDay, 7)) return { error: "Pick tonight or a night in the next week or so." };
  const existing = (await loadMeals(db, date, date)).get(date);
  if (existing?.status === "cooked") return { error: "That night's dinner is already made." };
  const [dish] = await db
    .select({ id: recipe.id, kind: recipe.kind })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), isNull(recipe.archivedAt)));
  if (!dish || dish.kind !== "main") return { error: "Pick a main dish." };
  const [who] = await db
    .select({ name: member.name })
    .from(member)
    .where(and(eq(member.id, memberId), isNull(member.archivedAt)));
  if (!who) return { error: "Unknown person." };
  if (!(await playCard(db, memberId, "chefs_pick", weekStart, recipeId))) {
    return { error: `${who.name} doesn't have a Chef's Pick card.` };
  }
  const planId = await saveNight(db, date, settings.weekStartsOn, {
    nightType: "cook",
    status: "planned",
    recipeId,
    sideRecipeIds: [],
    favoredMemberId: memberId,
    suggestionReason: `👨‍🍳 ${who.name}'s Chef's Pick`,
  });
  await regenerateGroceryList(db, planId);
  revalidatePath("/", "layout");
  return { ok: true };
}
