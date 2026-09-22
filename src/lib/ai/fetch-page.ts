/**
 * Reads a recipe web page. Most recipe sites embed schema.org Recipe data
 * (JSON-LD), which is far more reliable than the page text, so that's
 * preferred; otherwise the visible text is used, trimmed to a sane size.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 60_000;

export class PageFetchError extends Error {}

function isRecipeNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const type = (node as { "@type"?: unknown })["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function findRecipe(node: unknown): unknown {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isRecipeNode(node)) return node;
  const graph = (node as { "@graph"?: unknown })["@graph"];
  return graph ? findRecipe(graph) : null;
}

/** schema.org Recipe JSON-LD in the page, if any. */
export function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const found = findRecipe(JSON.parse(match[1].trim()));
      if (found) return found as Record<string, unknown>;
    } catch {
      // Some sites ship broken JSON-LD; keep looking.
    }
  }
  return null;
}

/** "www.allrecipes.com" → "Allrecipes" */
export function siteName(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "allrecipes.com": "Allrecipes",
      "foodnetwork.com": "Food Network",
      "food.com": "Food.com",
      "budgetbytes.com": "Budget Bytes",
      "seriouseats.com": "Serious Eats",
      "cooking.nytimes.com": "NYT Cooking",
      "tasteofhome.com": "Taste of Home",
      "delish.com": "Delish",
      "simplyrecipes.com": "Simply Recipes",
    };
    return known[host] ?? host.split(".").slice(-2, -1)[0]?.replace(/^./, (c) => c.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** Star rating and count from schema.org data, e.g. { rating: 4.8, count: 12345 }. */
export function ratingFromJsonLd(recipe: Record<string, unknown>): { rating: number | null; count: number | null } {
  const agg = recipe.aggregateRating as { ratingValue?: unknown; ratingCount?: unknown; reviewCount?: unknown } | undefined;
  if (!agg || typeof agg !== "object") return { rating: null, count: null };
  const rating = Number(agg.ratingValue);
  const count = Number(agg.ratingCount ?? agg.reviewCount);
  return {
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : null,
  };
}

/** Turns a schema.org Recipe into compact text for the importer (no reviews, images or video). */
export function jsonLdToText(recipe: Record<string, unknown>): string {
  const { review: _r, aggregateRating: _a, image: _i, video: _v, ...rest } = recipe;
  return `Structured recipe data from the page:\n${JSON.stringify(rest).slice(0, MAX_TEXT)}`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&frac12;/g, "½")
    .replace(/&frac14;/g, "¼")
    .replace(/&frac34;/g, "¾")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function fetchRecipePage(
  rawUrl: string,
): Promise<{ text: string; url: string; rating: { rating: number | null; count: number | null } }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PageFetchError("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new PageFetchError("Only web links work here.");
  // Don't let the server be pointed at itself or the local network.
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new PageFetchError("That link isn't a public web page.");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DinnerRoulette/1.0; family recipe import)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new PageFetchError("Couldn't reach that page. Check the link, or paste the recipe text instead.");
  }
  if (!response.ok) {
    throw new PageFetchError(
      response.status === 403
        ? /allrecipes\.com$/.test(url.hostname)
          ? "Allrecipes blocks apps from reading it. Use the “Send to Cruz Meals” button on the Allrecipes page instead (see Add a recipe), or take screenshots."
          : "That site blocks apps from reading it. Copy and paste the recipe text instead."
        : `That page answered with an error (${response.status}). Try pasting the recipe text instead.`,
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new PageFetchError("That page is huge. Paste just the recipe text instead.");
  const html = new TextDecoder().decode(buffer);

  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd) return { text: jsonLdToText(jsonLd), url: response.url, rating: ratingFromJsonLd(jsonLd) };
  const text = htmlToText(html);
  if (text.length < 200) throw new PageFetchError("Couldn't find a recipe on that page. Try pasting the text instead.");
  return { text: text.slice(0, MAX_TEXT), url: response.url, rating: { rating: null, count: null } };
}
