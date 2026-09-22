import "server-only";
import { z } from "zod";
import type { Recipe } from "@/lib/recipes/schema";
import { structured } from "./claude";
import { describeFamily, generateRecipe, normalizeAiRecipe, type FamilyBrief } from "./recipes";

const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        existingSlug: z.string().nullable().describe("Slug from the family's side list, or null for a new idea"),
        title: z.string().describe("Side dish name, e.g. 'Garlic bread'"),
        why: z.string().describe("One short, friendly reason it goes with this dinner"),
        handsOnMinutes: z.number().int(),
        healthy: z.boolean().describe("true for a vegetable or salad"),
      }),
    )
    .describe("3 or 4 sides, best first"),
});

export type SideSuggestion = z.infer<typeof suggestionSchema>["suggestions"][number];

/**
 * Picks sides for a dinner: from the family's own sides when they fit, and
 * easy new ideas when they don't (garlic bread with pasta).
 */
export async function recommendSides(
  main: Pick<Recipe, "title" | "cuisine" | "healthCategory" | "ingredients" | "method">,
  brief: FamilyBrief,
  alreadyChosen: string[],
): Promise<SideSuggestion[]> {
  const result = await structured({
    feature: "side ideas",
    tier: "fast",
    system: `You suggest side dishes for a family's weeknight dinner. Classic, easy pairings the whole family will eat: garlic bread or a Caesar salad with pasta, corn and slaw with barbecue, rice and beans with tacos, roasted broccoli with chicken. Most sides should take 15 minutes or less of hands-on time; store-bought shortcuts are welcome. Balance the plate: with a heavy or comfort main, include a vegetable or salad. Don't suggest anything that duplicates what's already in the main dish (no potatoes with pot roast that has potatoes in it).

Use the family's existing sides when one fits (set existingSlug to its slug exactly). If fewer than two of their sides fit well, add new ideas (existingSlug null). Mix in at least one new idea when their side list is short, so it can grow.

${describeFamily(brief)}`,
    content: `Tonight's main: ${main.title} (${main.cuisine}, ${main.method}, ${main.healthCategory}). Main ingredients: ${main.ingredients
      .filter((i) => !i.optional)
      .map((i) => i.name)
      .slice(0, 25)
      .join(", ")}.${alreadyChosen.length ? `\nAlready on the plate: ${alreadyChosen.join(", ")}. Suggest different ones.` : ""}\n\nThe family's sides: ${
      brief.sides.length ? brief.sides.map((s) => `${s.slug} (${s.title})`).join(", ") : "none yet"
    }.`,
    schema: suggestionSchema,
    effort: "low",
    maxTokens: 4000,
  });
  const known = new Set(brief.sides.map((s) => s.slug));
  return result.suggestions
    .slice(0, 4)
    .map((s) => ({ ...s, existingSlug: s.existingSlug && known.has(s.existingSlug) ? s.existingSlug : null, title: s.title.trim() }))
    .filter((s) => s.title);
}

/** Writes a full recipe for a side the family picked from the suggestions. */
export async function writeSideRecipe(title: string, forMain: string, brief: FamilyBrief): Promise<Recipe | null> {
  const result = await generateRecipe(
    `${title}, a quick side dish to serve with ${forMain}. This is a SIDE DISH: set kind to "side", keep it simple (store-bought shortcuts are fine), and leave pairsWith empty.`,
    brief,
    { tier: "fast", feature: "side recipe" },
  );
  if (!result.found || !result.recipe) return null;
  const { recipe } = normalizeAiRecipe({ ...result.recipe, kind: "side", pairsWith: [] });
  return recipe;
}
