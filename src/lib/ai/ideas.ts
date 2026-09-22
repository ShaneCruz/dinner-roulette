import "server-only";
import { z } from "zod";
import { structured } from "./claude";
import { describeFamily, generateRecipe, normalizeAiRecipe, type FamilyBrief } from "./recipes";

const ideasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe("One or two appetizing sentences a kid would also get excited about"),
      emoji: z.string().describe("One food emoji"),
      cuisine: z.string(),
      activeMinutes: z.number().int(),
      totalMinutes: z.number().int(),
      healthCategory: z.enum(["healthy", "balanced", "comfort"]),
      spiceLevel: z.number().int().describe("0-3, as served to the whole family"),
      kidAppeal: z.string().describe("Short: why kids will eat it"),
      twistOn: z.string().nullable().describe("The family favorite this is a twist on, or null"),
    }),
  ),
});

export type DinnerIdea = z.infer<typeof ideasSchema>["ideas"][number];

/**
 * Deals a batch of new dinner ideas for the family to swipe through. Mixes
 * twists on favorites with a few new directions, skipping anything they
 * already have or said no to.
 */
export async function suggestDinnerIdeas(
  brief: FamilyBrief,
  known: { have: string[]; rejected: string[]; accepted: string[] },
  season: string,
  count = 8,
): Promise<DinnerIdea[]> {
  const result = await structured({
    system: `You suggest new family dinners for a family to swipe through (like a dating app, for recipes). Every idea must be a real, recognizable dish that a busy, not-very-confident cook can make on a weeknight with normal grocery store ingredients, and that kids are likely to eat.

Mix it up across the batch:
- About half are twists on the family's favorites (a different protein, cuisine, or cooking method).
- The rest widen their range: different cuisines (Mexican, Italian, Asian takeout-style, Greek, American comfort, BBQ, breakfast-for-dinner), different proteins (chicken, beef, pork, turkey, fish, shrimp, vegetarian), and different formats (sheet pan, slow cooker, one pot, grill, bowls, soups, sandwiches, tacos).
- Include at least two healthy ones, at least one slow cooker or hands-off one, and at least one ready in 30 minutes.
- Never repeat a dinner they already have or turned down, and don't suggest near-duplicates of those either.

Learn from what they accepted and rejected before: lean toward what they said yes to.

${describeFamily(brief)}`,
    content: `It's ${season}.\nDinners they already have: ${known.have.join(", ") || "none"}.\nIdeas they said yes to before: ${known.accepted.join(", ") || "none yet"}.\nIdeas they turned down: ${known.rejected.join(", ") || "none yet"}.\n\nSuggest ${count} new dinner ideas.`,
    schema: ideasSchema,
    effort: "medium",
    maxTokens: 8000,
  });
  const taken = new Set([...known.have, ...known.rejected, ...known.accepted].map((t) => t.toLowerCase()));
  return result.ideas.filter((i) => i.title.trim() && !taken.has(i.title.trim().toLowerCase())).slice(0, count);
}

/** Writes the full recipe for an idea the family said yes to. */
export async function writeIdeaRecipe(idea: { title: string; description: string; twistOn: string | null }, brief: FamilyBrief) {
  const result = await generateRecipe(
    `${idea.title}: ${idea.description}${idea.twistOn ? ` (a twist on the family's ${idea.twistOn})` : ""}. This is a main dish.`,
    brief,
  );
  if (!result.found || !result.recipe) return null;
  return normalizeAiRecipe({ ...result.recipe, kind: "main" }, brief.sides.map((s) => s.slug));
}
