import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getRecipe, listRecipes } from "@/lib/recipes/store";
import { requireParentMember } from "@/lib/session";

export const metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[slug]/edit">) {
  await requireParentMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();
  const sides = await listRecipes(db, { kind: "side" });

  const { id, source: _source, sourceUrl: _sourceUrl, status: _status, notes, archivedAt: _a, createdAt: _c, updatedAt: _u, ...editable } =
    recipe;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${recipe.title}`} />
      <RecipeForm
        initial={editable}
        existingId={id}
        initialNotes={notes}
        sides={sides.filter((s) => s.id !== id).map((s) => ({ slug: s.slug, title: s.title }))}
      />
    </div>
  );
}
