import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { PageFetchError, fetchRecipePage, jsonLdToText, ratingFromJsonLd, siteName } from "@/lib/ai/fetch-page";
import { generateRecipe, importRecipe, inventNewMeal, normalizeAiRecipe, parseRatingText, type ImportSource } from "@/lib/ai/recipes";
import { saveDraftRecipe } from "@/lib/ai/save";
import { ensureNutrition } from "@/lib/nutrition-store";
import { getRecipe, listRecipes, type SourceRating } from "@/lib/recipes/store";
import { season } from "@/lib/suggest/engine";
import { todayIn } from "@/lib/presence";
import { getActingMember, getFamilySettings, getParentSession } from "@/lib/session";

// Reading a recipe with Claude can take a minute or two.
export const maxDuration = 300;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!(await getParentSession())) return fail("Please sign in again.", 401);
  const acting = await getActingMember();
  if (acting?.role !== "parent") return fail("Only parents can add recipes.", 403);
  if (!aiEnabled()) return fail("AI isn't set up yet. Add ANTHROPIC_API_KEY to turn it on.", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("That upload was too big. Photos are shrunk automatically; PDFs need to be under 4 MB.", 413);
  }
  const mode = String(form.get("mode") ?? "");
  const tweaks = String(form.get("tweaks") ?? "").trim().slice(0, 2000);

  try {
    const brief = await loadFamilyBrief(db);
    const sideSlugs = brief.sides.map((s) => s.slug);
    let result;
    let sourceUrl: string | null = null;
    let source: "ai" | "import" = "import";
    let rating: SourceRating | null = null;

    if (mode === "photo" || mode === "pdf") {
      const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      if (!files.length) return fail("Pick a photo or PDF first.");
      if (files.some((f) => f.size > MAX_FILE_BYTES)) return fail("Each file needs to be under 4 MB.");
      let importSource: ImportSource;
      if (mode === "pdf") {
        const pdf = files[0];
        if (pdf.type !== "application/pdf") return fail("That isn't a PDF.");
        importSource = { kind: "pdf", data: Buffer.from(await pdf.arrayBuffer()).toString("base64") };
      } else {
        if (files.length > 6) return fail("Up to 6 photos at a time, please.");
        const images = [];
        for (const file of files) {
          if (!IMAGE_TYPES.includes(file.type as ImageType)) return fail("Photos need to be JPEG, PNG, WebP or GIF.");
          images.push({ mediaType: file.type as ImageType, data: Buffer.from(await file.arrayBuffer()).toString("base64") });
        }
        importSource = { kind: "images", images };
      }
      result = await importRecipe(importSource, brief, tweaks);
    } else if (mode === "link") {
      const url = String(form.get("url") ?? "").trim();
      if (!url) return fail("Paste a link first.");
      const page = await fetchRecipePage(url);
      sourceUrl = page.url;
      if (page.rating.rating || page.rating.count) rating = { site: siteName(page.url), ...page.rating };
      result = await importRecipe({ kind: "text", text: page.text, sourceUrl: page.url }, brief, tweaks);
    } else if (mode === "sent") {
      // Sent from the "Send to Dinner Roulette" button on a recipe site: the
      // page's own structured data, read in the family's browser.
      let payload: { url?: unknown; recipe?: unknown };
      try {
        payload = JSON.parse(String(form.get("payload") ?? "").slice(0, 400_000));
      } catch {
        return fail("That recipe didn't come through. Try the button again.");
      }
      const ld = payload.recipe && typeof payload.recipe === "object" ? (payload.recipe as Record<string, unknown>) : null;
      const pageUrl = typeof payload.url === "string" && /^https?:\/\//.test(payload.url) ? payload.url.slice(0, 500) : null;
      if (!ld) return fail("No recipe was found on that page.");
      sourceUrl = pageUrl;
      const found = ratingFromJsonLd(ld);
      rating = { site: pageUrl ? siteName(pageUrl) : null, ...found };
      result = await importRecipe({ kind: "text", text: jsonLdToText(ld), sourceUrl: pageUrl ?? undefined }, brief, tweaks);
    } else if (mode === "text") {
      const text = String(form.get("text") ?? "").trim();
      if (text.length < 20) return fail("Paste or type a bit more of the recipe.");
      result = await importRecipe({ kind: "text", text: text.slice(0, 60_000) }, brief, tweaks);
    } else if (mode === "describe") {
      const description = String(form.get("text") ?? "").trim();
      if (description.length < 3) return fail("Tell me what you'd like to make.");
      source = "ai";
      result = await generateRecipe(description.slice(0, 2000), brief);
    } else if (mode === "surprise") {
      source = "ai";
      const settings = await getFamilySettings();
      const titles = (await listRecipes(db, { kind: "main", includeArchived: true })).map((r) => r.title);
      result = await inventNewMeal(brief, titles, season(todayIn(settings?.timezone ?? "America/Chicago")));
    } else {
      return fail("Unknown import type.");
    }

    if (!result.found || !result.recipe) {
      return fail(result.problem ?? "Couldn't find a recipe in that. Try a clearer photo or paste the text.", 422);
    }
    const normalized = normalizeAiRecipe(result.recipe, sideSlugs);
    // Screenshots and pasted text can show a rating too ("4.8 stars, 12,345 ratings").
    if (!rating && "rating" in result) {
      const parsed = parseRatingText(result.rating);
      if (parsed) rating = { ...parsed, site: parsed.site ?? (sourceUrl ? siteName(sourceUrl) : null) };
    }
    const slug = await saveDraftRecipe(db, normalized.recipe, {
      source,
      sourceUrl,
      notes: normalized.notes,
      warnings: normalized.warnings,
      createdByMemberId: acting.id,
      sourceRating: source === "import" ? rating : null,
    });
    after(async () => {
      try {
        const saved = await getRecipe(db, { slug });
        if (saved) await ensureNutrition(db, saved.id);
      } catch (error) {
        console.error("Nutrition estimate failed", error);
      }
    });
    return NextResponse.json({ slug, warnings: normalized.warnings });
  } catch (error) {
    if (error instanceof PageFetchError) return fail(error.message, 422);
    console.error("Recipe import failed", error);
    return fail(friendlyAiError(error), 502);
  }
}
