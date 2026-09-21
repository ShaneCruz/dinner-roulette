"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { recipeInputSchema, type RecipeInput } from "@/lib/recipes/schema";
import { getRecipe, saveRecipe, setRecipeArchived, slugify, uniqueSlug } from "@/lib/recipes/store";
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

  await saveRecipe(
    db,
    parsed.data,
    {
      // Editing a starter makes it the family's own version
      source: existing ? (existing.source === "starter" ? "manual" : existing.source) : "manual",
      sourceUrl: existing?.sourceUrl ?? null,
      status: "approved",
      notes,
      createdByMemberId: acting.id,
    },
    existingId ?? undefined,
  );
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
