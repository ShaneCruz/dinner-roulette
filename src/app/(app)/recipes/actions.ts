"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ensureNutrition } from "@/lib/nutrition-store";
import { friendlyAiError } from "@/lib/ai/claude";
import { acceptProposal, createProposal, dismissProposal, undoLastChange } from "@/lib/recipes/proposals";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { recipe as recipeTable } from "@/db/schema";
import { recipeInputSchema, type RecipeInput } from "@/lib/recipes/schema";
import {
  deleteRecipe,
  getRecipe,
  removeRecipePhoto,
  saveRecipe,
  saveRecipePhoto,
  setRecipeArchived,
  setRecipeImageUrl,
  slugify,
  uniqueSlug,
} from "@/lib/recipes/store";
import { PageFetchError, fetchRecipePage } from "@/lib/ai/fetch-page";
import { aiEnabled } from "@/lib/ai/claude";
import { loadDinnerCandidates, recommendDinners, type DinnerTurn } from "@/lib/ai/dinner-picks";
import { recipePictureSrc } from "@/lib/recipes/picture";
import { COOK_METHOD_LABELS } from "@/lib/recipes/schema";
import { requireActingMember, requireParentMember } from "@/lib/session";
import { z } from "zod";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { askAboutRecipe } from "@/lib/ai/kitchen";
import { eatersFor, loadEaterContext, loadMeals, servingsFor, servingsRule, servingsToMake } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { listRecipes } from "@/lib/recipes/store";

export async function saveRecipeAction(
  input: RecipeInput,
  existingId: string | null,
  notes: string | null,
): Promise<{ error: string } | void> {
  const { acting } = await requireParentMember();

  const slug = await uniqueSlug(db, slugify(input.title), existingId ?? undefined);
  const parsed = recipeInputSchema.safeParse({ ...input, slug });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(" › ")}: ${issue.message}` };
  }

  const existing = existingId ? await getRecipe(db, { id: existingId }) : null;
  if (existingId && !existing) return { error: "That recipe no longer exists." };

  // Nutrition only depends on the ingredients and servings; keep it if those didn't change.
  const sameFood =
    existing &&
    existing.baseServings === parsed.data.baseServings &&
    JSON.stringify(existing.ingredients) === JSON.stringify(parsed.data.ingredients);
  const id = await saveRecipe(
    db,
    parsed.data,
    {
      nutrition: sameFood ? existing.nutrition : null,
      // Editing a starter makes it the family's own version
      source: existing ? (existing.source === "starter" ? "manual" : existing.source) : "manual",
      sourceUrl: existing?.sourceUrl ?? null,
      status: "approved",
      notes,
      createdByMemberId: acting.id,
    },
    existingId ?? undefined,
  );
  after(async () => {
    try {
      await ensureNutrition(db, id);
    } catch (error) {
      console.error("Nutrition estimate failed", error);
    }
  });
  revalidatePath("/recipes");
  redirect(`/recipes/${slug}`);
}

export async function archiveRecipe(id: string, archived: boolean) {
  await requireParentMember();
  await setRecipeArchived(db, id, archived);
  revalidatePath("/recipes");
  const recipe = await getRecipe(db, { id });
  redirect(archived ? "/recipes" : `/recipes/${recipe?.slug ?? ""}`);
}

/** Retires an older recipe in place (used when an import replaces it). */
export async function retireRecipe(id: string) {
  await requireParentMember();
  await setRecipeArchived(db, id, true);
  revalidatePath("/recipes");
}

/** Throws away an import that hasn't been saved yet. */
export async function discardDraft(id: string) {
  await requireParentMember();
  const recipe = await getRecipe(db, { id });
  if (recipe?.status === "draft") await deleteRecipe(db, id);
  revalidatePath("/recipes");
  redirect("/recipes");
}

/** Estimates nutrition right now for a recipe that doesn't have it. */
export async function estimateNutritionAction(id: string): Promise<{ error: string } | void> {
  await requireParentMember();
  try {
    await ensureNutrition(db, id);
  } catch (error) {
    console.error("Nutrition estimate failed", error);
    return { error: "Couldn't estimate that right now. Try again in a minute." };
  }
  revalidatePath("/", "layout");
}

/** Asks Claude to tweak a recipe (from a parent's request and the family's ratings). */
export async function requestTweakAction(recipeId: string, request: string): Promise<{ error: string } | void> {
  const { acting } = await requireParentMember();
  const text = request.trim().slice(0, 1000);
  if (text.length < 3) return { error: "Say what you'd like changed." };
  try {
    const result = await createProposal(db, recipeId, { request: text, memberId: acting.id });
    if (!result.created) return { error: result.reason };
  } catch (error) {
    console.error("Recipe tweak failed", error);
    return { error: friendlyAiError(error) };
  }
  revalidatePath("/", "layout");
}

export async function acceptProposalAction(proposalId: string): Promise<{ error: string } | void> {
  await requireParentMember();
  const recipeId = await acceptProposal(db, proposalId);
  if (!recipeId) return { error: "That suggestion was already handled." };
  after(async () => {
    try {
      await ensureNutrition(db, recipeId);
    } catch (error) {
      console.error("Nutrition estimate failed", error);
    }
  });
  revalidatePath("/", "layout");
}

export async function dismissProposalAction(proposalId: string) {
  await requireParentMember();
  await dismissProposal(db, proposalId);
  revalidatePath("/", "layout");
}

export async function undoChangeAction(recipeId: string): Promise<{ error: string } | void> {
  await requireParentMember();
  if (!(await undoLastChange(db, recipeId))) return { error: "Nothing to undo." };
  after(async () => {
    try {
      await ensureNutrition(db, recipeId);
    } catch (error) {
      console.error("Nutrition estimate failed", error);
    }
  });
  revalidatePath("/", "layout");
}

/** Records how a recipe is rated on the site it came from (typed in by a parent). */
export async function setSourceRatingAction(
  recipeId: string,
  input: { site: string; rating: number | null; count: number | null },
): Promise<{ error: string } | void> {
  await requireParentMember();
  const site = input.site.trim().slice(0, 40) || null;
  const rating = input.rating !== null && input.rating > 0 && input.rating <= 5 ? Math.round(input.rating * 10) / 10 : null;
  const count = input.count !== null && input.count > 0 ? Math.round(input.count) : null;
  await db
    .update(recipeTable)
    .set({ sourceName: site, sourceRating: rating, sourceRatingCount: count, updatedAt: sql`${recipeTable.updatedAt}` as unknown as Date })
    .where(eq(recipeTable.id, recipeId));
  revalidatePath("/", "layout");
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Answers a question about a recipe, for whoever is cooking. */
export async function askRecipeQuestion(
  recipeId: string,
  history: ChatTurn[],
): Promise<{ error: string } | { answer: string; tweak: string | null }> {
  const { settings } = await requireActingMember();
  if (!z.uuid().safeParse(recipeId).success) return { error: "Unknown recipe." };
  const turns = history
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-8)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1500) }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "Ask a question first." };

  const recipe = await getRecipe(db, { id: recipeId });
  if (!recipe) return { error: "That recipe is gone." };
  try {
    const today = todayIn(settings.timezone);
    const [brief, meals, eaterContext, sides] = await Promise.all([
      loadFamilyBrief(db),
      loadMeals(db, today, today),
      loadEaterContext(db, today, today),
      listRecipes(db, { kind: "side" }),
    ]);
    const tonight = meals.get(today);
    const onTonight = tonight?.nightType === "cook" && (tonight.recipeId === recipe.id || tonight.sideRecipeIds.includes(recipe.id));
    const titles = new Map(sides.map((s) => [s.id, s.title]));
    return await askAboutRecipe(
      recipe,
      {
        servings: onTonight && tonight
          ? servingsFor(tonight, eatersFor(eaterContext, today, tonight.eaterIds).length, servingsRule(eaterContext, settings.usualServings))
          : (await servingsToMake(db, recipe.id, today, settings.usualServings)).servings,
        tonight: Boolean(onTonight),
        sidesTonight: onTonight && tonight ? tonight.sideRecipeIds.map((id) => titles.get(id)).filter((t): t is string => Boolean(t)) : [],
        availableSides: sides.map((s) => s.title).slice(0, 30),
      },
      brief,
      turns,
    );
  } catch (error) {
    console.error("Recipe question failed", error);
    return { error: friendlyAiError(error) };
  }
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 900 * 1024;

/** Saves a photo the family took. The phone shrinks it first. */
export async function uploadRecipePhotoAction(recipeId: string, form: FormData): Promise<{ error: string } | void> {
  await requireParentMember();
  if (!z.uuid().safeParse(recipeId).success) return { error: "Unknown recipe." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { error: "Photos need to be JPEG, PNG or WebP." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too big. Try a different one." };
  const found = await getRecipe(db, { id: recipeId });
  if (!found) return { error: "That recipe is gone." };
  await saveRecipePhoto(db, recipeId, {
    contentType: file.type,
    data: Buffer.from(await file.arrayBuffer()).toString("base64"),
  });
  revalidatePath("/", "layout");
}

/** Takes the picture off: the family's photo if there is one, otherwise the source site's. */
export async function removeRecipePictureAction(recipeId: string) {
  await requireParentMember();
  if (!z.uuid().safeParse(recipeId).success) return;
  const found = await getRecipe(db, { id: recipeId });
  if (!found) return;
  if (found.photoAt) await removeRecipePhoto(db, recipeId);
  else await setRecipeImageUrl(db, recipeId, null);
  revalidatePath("/", "layout");
}

/** Fetches the picture from the page a recipe came from. */
export async function findSourcePictureAction(recipeId: string): Promise<{ error: string } | void> {
  await requireParentMember();
  if (!z.uuid().safeParse(recipeId).success) return { error: "Unknown recipe." };
  const found = await getRecipe(db, { id: recipeId });
  if (!found?.sourceUrl) return { error: "This recipe didn't come from a web page." };
  try {
    const page = await fetchRecipePage(found.sourceUrl);
    if (!page.image) return { error: "That page doesn't have a picture to use. Add your own photo instead." };
    await setRecipeImageUrl(db, recipeId, page.image);
  } catch (error) {
    if (error instanceof PageFetchError && /allrecipes\.com/i.test(found.sourceUrl)) {
      return {
        error: "Allrecipes won't let the app fetch it. Open the recipe on Allrecipes and tap your “Send to Cruz Meals” button; it'll add the picture here.",
      };
    }
    return { error: error instanceof PageFetchError ? error.message : "Couldn't reach that page. Try again later." };
  }
  revalidatePath("/", "layout");
}

export type DinnerIdea = {
  id: string;
  slug: string;
  title: string;
  picture: string | null;
  why: string;
  tip: string | null;
  activeMinutes: number;
  totalMinutes: number;
  method: string;
};

const turnsSchema = z
  .array(z.object({ ask: z.string().trim().min(1).max(500), shown: z.array(z.string().max(200)).max(5) }))
  .min(1);

/**
 * "What should we have tonight?" in the family's own words: picks from the
 * recipe box that fit, skipping what they had lately. Follow-ups ("we've had
 * a lot of pasta, something different") come with the earlier rounds.
 */
export async function askForDinnerAction(
  conversation: DinnerTurn[],
): Promise<{ error: string } | { ideas: DinnerIdea[]; note: string | null; tonight: { date: string } }> {
  const { settings } = await requireParentMember();
  const parsed = turnsSchema.safeParse(conversation);
  if (!parsed.success || parsed.data[parsed.data.length - 1].ask.length < 3) {
    return { error: "Tell me a little about tonight first." };
  }
  // The newest message and the few rounds before it are plenty.
  const turns = parsed.data.slice(-5);
  if (!aiEnabled()) return { error: "AI isn't set up yet." };
  const today = todayIn(settings.timezone);
  try {
    const [candidates, brief] = await Promise.all([loadDinnerCandidates(db, today), loadFamilyBrief(db)]);
    if (!candidates.length) return { error: "Add a few dinners to the recipe box first." };
    const { picks, note } = await recommendDinners(turns, candidates, today, brief, settings.dinnerTime);
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    const rows = await listRecipes(db);
    const pictures = new Map(rows.map((r) => [r.id, recipePictureSrc(r)]));
    return {
      ideas: picks.map((p) => {
        const c = bySlug.get(p.slug)!;
        return {
          id: c.id,
          slug: c.slug,
          title: c.title,
          picture: pictures.get(c.id) ?? null,
          why: p.why,
          tip: p.tip,
          activeMinutes: c.activeMinutes,
          totalMinutes: c.totalMinutes,
          method: COOK_METHOD_LABELS[c.method],
        };
      }),
      note: picks.length ? note : note ?? "Nothing in the recipe box fits that. Try loosening it a little.",
      tonight: { date: today },
    };
  } catch (error) {
    console.error("Dinner ideas failed", error);
    return { error: friendlyAiError(error) };
  }
}
