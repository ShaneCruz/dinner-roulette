import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getRecipe, listRecipes, similarRecipes } from "@/lib/recipes/store";
import { requireParentMember } from "@/lib/session";
import { DraftActions, RetireButton } from "./draft-actions";
import { SourceRatingBadge } from "@/components/source-rating";
import { SourceRatingEditor } from "../source-rating-editor";

export const metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[slug]/edit">) {
  await requireParentMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();
  const [sides, similar] = await Promise.all([
    listRecipes(db, { kind: "side" }),
    recipe.status === "draft" ? similarRecipes(db, recipe.id, recipe.title) : Promise.resolve([]),
  ]);

  const { id, source: _source, sourceUrl, status, notes, archivedAt: _a, createdAt: _c, updatedAt: _u, ...editable } =
    recipe;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={status === "draft" ? `Check over ${recipe.title}` : `Edit ${recipe.title}`} />
      {status === "draft" ? (
        <Card className="mb-6 space-y-3 border-mustard bg-mustard-soft">
          <p className="font-bold">✨ Here&apos;s your recipe. Give it a quick look, then tap Save.</p>
          <p className="text-sm">
            Check the amounts, steps, and times. The mild, no-beef, and healthy versions were added for your family;
            delete any you don&apos;t want.
            {sourceUrl ? (
              <>
                {" "}
                From{" "}
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  {new URL(sourceUrl).hostname}
                </a>
                .
              </>
            ) : null}
          </p>
          {similar.length ? (
            <div className="rounded-2xl bg-surface p-3">
              <p className="text-sm font-semibold">You already have something similar. Retire the old one?</p>
              <ul className="mt-2 space-y-1">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{s.title}</span>
                    <RetireButton id={s.id} title={s.title} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DraftActions id={id} />
        </Card>
      ) : null}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">Where it came from</p>
          <p className="text-sm text-muted">
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">
                {new URL(sourceUrl).hostname}
              </a>
            ) : (
              "Added by hand"
            )}
            {recipe.sourceRating ? " · rated on that site" : " · no rating yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourceRatingBadge rating={recipe.sourceRating} url={sourceUrl} />
          <SourceRatingEditor recipeId={id} initialSite={recipe.sourceRating?.site ?? null} />
        </div>
      </Card>
      <RecipeForm
        initial={editable}
        existingId={id}
        initialNotes={notes}
        sides={sides.filter((s) => s.id !== id).map((s) => ({ slug: s.slug, title: s.title }))}
      />
    </div>
  );
}
