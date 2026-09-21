import { RecipeForm, blankRecipe } from "@/components/recipe-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { listRecipes } from "@/lib/recipes/store";
import { requireParentMember } from "@/lib/session";

export const metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  await requireParentMember();
  const sides = await listRecipes(db, { kind: "side" });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New recipe" subtitle="Type it in. (Soon: paste a link or snap a photo instead.)" />
      <RecipeForm
        initial={blankRecipe()}
        existingId={null}
        initialNotes={null}
        sides={sides.map((s) => ({ slug: s.slug, title: s.title }))}
      />
    </div>
  );
}
