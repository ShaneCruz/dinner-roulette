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
import { deleteRecipe, getRecipe, saveRecipe, setRecipeArchived, slugify, uniqueSlug } from "@/lib/recipes/store";
import { requireActingMember, requireParentMember } from "@/lib/session";
import { z } from "zod";
import { loadFamilyBrief } from "@/lib/ai/brief";
import { askAboutRecipe } from "@/lib/ai/kitchen";
import { eatersFor, loadEaterContext, loadMeals, servingsFor } from "@/lib/plan/store";
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
        servings: onTonight && tonight ? servingsFor(tonight, eatersFor(eaterContext, today, tonight.eaterIds).length) : recipe.baseServings,
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
