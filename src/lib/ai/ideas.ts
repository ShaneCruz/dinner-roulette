import "server-only";
import { z } from "zod";
import type { SourceRating } from "@/lib/recipes/store";
import { research, structured } from "./claude";
import { fetchRecipePage, siteName } from "./fetch-page";
import { describeFamily, generateRecipe, importRecipe, normalizeAiRecipe, type FamilyBrief } from "./recipes";

const ideasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe("One or two appetizing sentences a kid would also get excited about"),
      emoji: z.string().describe("One food emoji"),
      cuisine: z.string(),
      activeMinutes: z.number().int(),
      totalMinutes: z.number().int(),
      healthCategory: z.string().describe("One of: healthy, balanced, comfort"),
      spiceLevel: z.number().int().describe("0-3, as served to the whole family"),
      kidAppeal: z.string().describe("Short: why kids will eat it"),
      twistOn: z.string().nullable().describe("The family favorite this is a twist on, or null"),
    }),
  ),
});

type RawIdea = z.infer<typeof ideasSchema>["ideas"][number];
export type DinnerIdea = Omit<RawIdea, "healthCategory"> & { healthCategory: "healthy" | "balanced" | "comfort" };

const HEALTH = ["healthy", "balanced", "comfort"] as const;

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
    feature: "discover ideas",
    tier: "fast",
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
  return result.ideas
    .filter((i) => i.title.trim() && !taken.has(i.title.trim().toLowerCase()))
    .slice(0, count)
    .map((i) => {
      const health = i.healthCategory.trim().toLowerCase();
      return { ...i, healthCategory: (HEALTH as readonly string[]).includes(health) ? (health as DinnerIdea["healthCategory"]) : "balanced" };
    });
}

/** Writes the full recipe for an idea the family said yes to. */
export async function writeIdeaRecipe(idea: { title: string; description: string; twistOn: string | null }, brief: FamilyBrief) {
  const result = await generateRecipe(
    `${idea.title}: ${idea.description}${idea.twistOn ? ` (a twist on the family's ${idea.twistOn})` : ""}. This is a main dish.`,
    brief,
    { tier: "fast", feature: "discover recipe" },
  );
  if (!result.found || !result.recipe) return null;
  return normalizeAiRecipe({ ...result.recipe, kind: "main" }, brief.sides.map((s) => s.slug));
}

/** Sites that aren't recipe pages, or that the app can't read. */
const NOT_RECIPES = /(^|\.)(youtube|youtu|pinterest|instagram|facebook|tiktok|reddit|x|twitter|nytimes|amazon)\.com$|(^|\.)youtu\.be$/i;

const urlKey = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * The recipe pages Claude named, best first, kept only if the web search
 * actually returned them (so no made-up addresses), then any other search
 * results that look like single recipes.
 */
export function pickRecipeUrls(text: string, searched: string[], limit = 5): string[] {
  const returned = new Map(searched.flatMap((url) => (urlKey(url) ? [[urlKey(url)!, url] as const] : [])));
  const named = [...text.matchAll(/https?:\/\/[^\s)\]>"'<]+/g)].map((m) => m[0].replace(/[.,;:!?]+$/, ""));
  const looksLikeRecipe = (url: string) => /recipe/i.test(url) && !/(recipes\/?$|\/(search|tag|category|collection|gallery)s?\b)/i.test(url);
  const out: string[] = [];
  for (const url of [...named.map((u) => returned.get(urlKey(u) ?? "") ?? null), ...searched.filter(looksLikeRecipe)]) {
    if (!url || out.includes(url)) continue;
    try {
      if (NOT_RECIPES.test(new URL(url).hostname.replace(/^www\./, ""))) continue;
    } catch {
      continue;
    }
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

/** Real, well-rated recipe pages for a dish, from a web search. */
export async function findRecipePages(idea: { title: string; description: string }): Promise<string[]> {
  const { text, sources } = await research({
    feature: "discover source",
    tier: "fast",
    maxSearches: 2,
    costCapCents: 8,
    system: `You find real, published recipes for a family's dinner app. Search for the dish and reply with up to 5 web addresses of individual recipe pages that match it closely (same main ingredients and style), best first, one per line, and nothing else.

Prefer well-rated recipes from established recipe sites: Budget Bytes, Simply Recipes, Taste of Home, Food Network, Delish, Serious Eats, The Pioneer Woman, Food.com, Allrecipes, Once Upon a Chef, Cookie and Kate, RecipeTin Eats. Only single recipe pages: no roundups ("25 best..."), videos, search pages or paywalled sites like NYT Cooking.`,
    prompt: `The dish: ${idea.title}. ${idea.description}`,
  });
  return pickRecipeUrls(text, sources.map((s) => s.url));
}

const STOP_WORDS = new Set(["with", "and", "the", "easy", "best", "quick", "simple", "homemade", "style", "recipe", "night", "dinner", "for"]);

/** The words in a dish's name worth matching: "Ham, Potato & Egg Sheet Pan Bake" → ham, potato, egg, sheet, pan, bake. */
export function dishWords(title: string): string[] {
  return [...new Set(title.toLowerCase().match(/[a-z]{3,}/g) ?? [])]
    .filter((w) => !STOP_WORDS.has(w))
    .map((w) => w.replace(/(es|s)$/, ""));
}

/** How well a recipe page matches the idea, 0 to 1: the share of the idea's words that turn up in it. */
export function matchScore(ideaTitle: string, pageText: string): number {
  const words = dishWords(ideaTitle);
  if (!words.length) return 0;
  const text = pageText.toLowerCase();
  return words.filter((w) => text.includes(w)).length / words.length;
}

/** Sites the family's importer reads well and whose recipes tend to be tested. */
const TRUSTED = /(^|\.)(budgetbytes|simplyrecipes|tasteofhome|foodnetwork|delish|seriouseats|thepioneerwoman|food|allrecipes|onceuponachef|cookieandkate|recipetineats|bonappetit|epicurious|eatingwell|bettycrocker|pillsbury|myrecipes|southernliving|thekitchn)\.com$/i;

/**
 * The real recipe behind an accepted idea: a published page found on the
 * web and imported, with its picture, star rating and a link back. Every
 * candidate page is read (cheap: no AI), and the one that best matches the
 * idea wins, with a nudge toward rated recipes from established sites. Null
 * when nothing readable matches, so the caller can write one instead.
 */
export async function importIdeaFromWeb(
  idea: { title: string; description: string },
  brief: FamilyBrief,
): Promise<(ReturnType<typeof normalizeAiRecipe> & { sourceUrl: string; imageUrl: string | null; rating: SourceRating | null }) | null> {
  const urls = await findRecipePages(idea);
  const pages = (
    await Promise.all(
      urls.map((url) =>
        fetchRecipePage(url).catch(() => null), // Blocked or gone: skip it.
      ),
    )
  ).filter((page): page is NonNullable<typeof page> => Boolean(page) && page!.text.startsWith("Structured recipe data"));
  const scored = pages
    .map((page, order) => {
      const match = matchScore(idea.title, page.text);
      let host = "";
      try {
        host = new URL(page.url).hostname.replace(/^www\./, "");
      } catch {}
      const rated = (page.rating.count ?? 0) >= 10 && (page.rating.rating ?? 0) >= 4;
      return { page, match, score: match * 3 + (rated ? 1 : 0) + (TRUSTED.test(host) ? 0.5 : 0) + (page.image ? 0.25 : 0) - order * 0.05 };
    })
    // A page about something else isn't the recipe she said yes to.
    .filter((c) => c.match >= 0.5)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.page;
  if (!best) return null;
  const result = await importRecipe({ kind: "text", text: best.text, sourceUrl: best.url }, brief);
  if (!result.found || !result.recipe) return null;
  return {
    ...normalizeAiRecipe({ ...result.recipe, kind: "main" }, brief.sides.map((s) => s.slug)),
    sourceUrl: best.url,
    imageUrl: best.image,
    rating: best.rating.rating || best.rating.count ? { site: siteName(best.url), ...best.rating } : null,
  };
}
