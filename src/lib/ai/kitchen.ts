import "server-only";
import type { Recipe } from "@/lib/recipes/schema";
import { chat } from "./claude";
import { describeFamily, type FamilyBrief } from "./recipes";
import { describeRecipe } from "./revise";

/**
 * Answers questions about the recipe you're cooking right now: swaps,
 * unfamiliar ingredients, what to serve with it, how to hold it for a late
 * eater. When the answer is really a change to the recipe, it says so, and
 * the app offers to turn that into a proper tweak.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type KitchenContext = {
  servings: number;
  tonight: boolean;
  sidesTonight: string[];
  availableSides: string[];
};

const TWEAK = /^TWEAK:\s*(.+)$/im;

export async function askAboutRecipe(
  recipe: Recipe,
  context: KitchenContext,
  brief: FamilyBrief,
  history: ChatTurn[],
): Promise<{ answer: string; tweak: string | null }> {
  const text = await chat({
    feature: "recipe questions",
    system: `You're a calm, practical cooking helper for one family, answering questions about the recipe they're making right now. Keep it short: two or three sentences, or a few short bullets. Be specific and concrete (amounts, temperatures, times). Say plainly when a swap will change the result, and give the fix. If you don't know, say so rather than guessing.

Answer for this family and this recipe only. Don't repeat the whole recipe back. Never suggest something that breaks a food they never eat, and remember the mildest eater when talking about heat.

If your answer amounts to a change worth keeping in the recipe (not just tonight), end your reply with a final line exactly like:
TWEAK: <one sentence describing the change>
Otherwise don't include that line.

The recipe:
${describeRecipe(recipe)}

Tonight: cooking for ${context.servings} servings${context.tonight ? " (it's on tonight's plan)" : ""}.${
      context.sidesTonight.length ? ` Sides already planned: ${context.sidesTonight.join(", ")}.` : ""
    }${context.availableSides.length ? ` Sides the family has recipes for: ${context.availableSides.join(", ")}.` : ""}

The family:
${describeFamily(brief)}`,
    messages: history.slice(-8),
  });

  const match = text.match(TWEAK);
  return { answer: text.replace(TWEAK, "").trim(), tweak: match?.[1]?.trim() ?? null };
}
