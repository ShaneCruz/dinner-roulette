"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { todayIn } from "@/lib/presence";
import { dealIdeas, decideIdea, pendingIdeas, writeAcceptedIdea } from "@/lib/recipes/ideas";
import { requireParentMember } from "@/lib/session";

export type IdeaCard = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cuisine: string;
  activeMinutes: number;
  totalMinutes: number;
  healthCategory: "healthy" | "balanced" | "comfort";
  spiceLevel: number;
  kidAppeal: string | null;
  twistOn: string | null;
};

/** Deals more ideas and returns everything waiting to be swiped. */
export async function dealMoreAction(): Promise<{ error: string } | { ideas: IdeaCard[] }> {
  const { settings } = await requireParentMember();
  if (!aiEnabled()) return { error: "AI isn't set up yet." };
  try {
    await dealIdeas(db, todayIn(settings.timezone));
  } catch (error) {
    console.error("Dealing ideas failed", error);
    return { error: friendlyAiError(error) };
  }
  const ideas = await pendingIdeas(db);
  return {
    ideas: ideas.map((i) => ({
      id: i.id, title: i.title, description: i.description, emoji: i.emoji, cuisine: i.cuisine,
      activeMinutes: i.activeMinutes, totalMinutes: i.totalMinutes, healthCategory: i.healthCategory,
      spiceLevel: i.spiceLevel, kidAppeal: i.kidAppeal, twistOn: i.twistOn,
    })),
  };
}

/** Yes writes the full recipe in the background and adds it; no remembers not to suggest it again. */
export async function decideIdeaAction(id: string, yes: boolean): Promise<{ error: string } | { ok: true }> {
  const { acting } = await requireParentMember();
  if (!z.uuid().safeParse(id).success) return { error: "Unknown idea." };
  if (!(await decideIdea(db, id, yes, acting.id))) return { error: "Already decided." };
  if (yes) after(() => writeAcceptedIdea(db, id));
  revalidatePath("/recipes", "layout");
  return { ok: true };
}
