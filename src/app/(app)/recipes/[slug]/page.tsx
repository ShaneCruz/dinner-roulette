import { inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, SpiceMeter } from "@/components/ui";
import { db } from "@/db";
import { recipe as recipeTable } from "@/db/schema";
import { loadAudience } from "@/lib/members";
import { heatSeekers, nopeConflicts, variantAudience } from "@/lib/recipes/audience";
import {
  COOK_METHOD_LABELS,
  HEALTH_LABELS,
  RECIPE_TAG_LABELS,
  SEASON_LABELS,
} from "@/lib/recipes/schema";
import { getRecipe } from "@/lib/recipes/store";
import { requireActingMember } from "@/lib/session";
import { archiveRecipe } from "../actions";
import { RecipeView } from "./recipe-view";

export async function generateMetadata({ params }: PageProps<"/recipes/[slug]">) {
  const found = await getRecipe(db, { slug: (await params).slug });
  return { title: found?.title ?? "Recipe" };
}

export default async function RecipePage({ params }: PageProps<"/recipes/[slug]">) {
  const { acting } = await requireActingMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();

  const audience = await loadAudience();
  const sides =
    recipe.pairsWith.length > 0
      ? await db
          .select({ slug: recipeTable.slug, title: recipeTable.title })
          .from(recipeTable)
          .where(inArray(recipeTable.slug, recipe.pairsWith))
      : [];

  const variants = recipe.variants.map((variant) => ({
    ...variant,
    forNames: variantAudience(recipe, variant, audience).map((m) => m.name),
  }));
  const heatFor = recipe.spiceSplit ? heatSeekers(audience).map((m) => m.name) : [];
  const conflicts = nopeConflicts(recipe, audience);
  const isParent = acting.role === "parent";

  return (
    <article>
      <Link href="/recipes" className="no-print text-sm font-semibold text-muted hover:text-foreground">
        ← Recipe box
      </Link>
      <header className="mb-6 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl">{recipe.title}</h1>
            <p className="mt-2 max-w-2xl text-lg text-muted">{recipe.description}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <ButtonLink href={`/recipes/${recipe.slug}/print`} variant="secondary" size="sm">
              🖨️ Print
            </ButtonLink>
            {isParent ? (
              <>
                <ButtonLink href={`/recipes/${recipe.slug}/edit`} variant="secondary" size="sm">
                  Edit
                </ButtonLink>
                <form action={archiveRecipe.bind(null, recipe.id, !recipe.archivedAt)}>
                  <button type="submit" className="h-9 px-3 text-sm font-semibold text-muted hover:text-tomato">
                    {recipe.archivedAt ? "Restore" : "Archive"}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={recipe.activeMinutes <= 30 ? "basil" : "mustard"}>
            ⏱ {recipe.activeMinutes} min hands-on
          </Badge>
          <Badge>🕰 {formatMinutes(recipe.totalMinutes)} total</Badge>
          <Badge>{COOK_METHOD_LABELS[recipe.method]}</Badge>
          <Badge tone={recipe.healthCategory === "healthy" ? "basil" : recipe.healthCategory === "comfort" ? "tomato" : "neutral"}>
            {HEALTH_LABELS[recipe.healthCategory]}
          </Badge>
          {recipe.seasonFit !== "any" ? <Badge tone="plum">{SEASON_LABELS[recipe.seasonFit]}</Badge> : null}
          {recipe.tags
            .filter((t) => t !== "healthy" && t !== "comfort")
            .map((tag) => (
              <Badge key={tag}>{RECIPE_TAG_LABELS[tag]}</Badge>
            ))}
          <SpiceMeter level={recipe.spiceLevel} />
          {recipe.archivedAt ? <Badge tone="tomato">Archived</Badge> : null}
          {recipe.status === "draft" ? <Badge tone="mustard">Draft</Badge> : null}
        </div>
      </header>

      {conflicts.length > 0 ? (
        <ul className="mb-4 space-y-1 rounded-2xl bg-mustard-soft px-4 py-3 text-sm">
          {conflicts.map((c) => (
            <li key={`${c.member.id}-${c.ingredient}`}>
              <strong>{c.member.name}</strong> skips {c.ingredient}
              {c.coveredBy ? ` · use “${c.coveredBy}”` : " · no swap yet"}
            </li>
          ))}
        </ul>
      ) : null}

      <RecipeView
        recipe={recipe}
        variants={variants}
        heatFor={heatFor}
        sides={sides}
      />

      {recipe.notes ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Family notes</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{recipe.notes}</p>
        </section>
      ) : null}
    </article>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
