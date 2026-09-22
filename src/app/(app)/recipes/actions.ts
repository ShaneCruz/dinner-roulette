"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ensureNutrition } from "@/lib/nutrition-store";
import { friendlyAiError } from "@/lib/ai/claude";
import { acceptProposal, createProposal, dismissProposal, undoLastChange } from "@/lib/recipes/proposals";
import { db } from "@/db";
import { recipeInputSchema, type RecipeInput } from "@/lib/recipes/schema";
import { deleteRecipe, getRecipe, saveRecipe, setRecipeArchived, slugify, uniqueSlug } from "@/lib/recipes/store";
import { requireParentMember } from "@/lib/session";

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
