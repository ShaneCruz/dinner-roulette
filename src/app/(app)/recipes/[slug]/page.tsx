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
import { ratingsForRecipe } from "@/lib/ratings/store";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { RatingsSummary } from "@/components/ratings-summary";
import { archiveRecipe } from "../actions";
import { RecipeView } from "./recipe-view";
import { RecipeTweaks } from "./recipe-tweaks";
import { diffRecipes } from "@/lib/recipes/diff";
import { latestRevision, pendingProposal } from "@/lib/recipes/proposals";
import { REASONS, reasonLabel } from "@/lib/ratings/scale";
import { EstimateNutritionButton } from "./estimate-button";
import { NutritionFacts } from "@/components/nutrition-facts";
import { aiEnabled } from "@/lib/ai/claude";

// Asking Claude for a recipe tweak can take a minute.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/recipes/[slug]">) {
  const found = await getRecipe(db, { slug: (await params).slug });
  return { title: found?.title ?? "Recipe" };
}

export default async function RecipePage({ params }: PageProps<"/recipes/[slug]">) {
  const { acting } = await requireActingMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();

  const [audience, ratings, members] = await Promise.all([
    loadAudience(),
    ratingsForRecipe(db, recipe.id),
    getActiveMembers(),
  ]);
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
  const [proposal, revision] = isParent
    ? await Promise.all([pendingProposal(db, recipe.id), latestRevision(db, recipe.id)])
    : [null, null];
  const complaintCounts = new Map<string, number>();
  for (const r of ratings) for (const id of r.reasons) if (!REASONS.find((x) => x.id === id)?.positive) complaintCounts.set(id, (complaintCounts.get(id) ?? 0) + 1);
  const complaints = [...complaintCounts.entries()].map(([id, n]) => `${reasonLabel(id)}${n > 1 ? ` (${n})` : ""}`);

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
            <ButtonLink href={`/cook/${recipe.slug}`} size="sm">
              👩‍🍳 Cooking mode
            </ButtonLink>
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

      {recipe.status === "draft" ? (
        <p className="mb-4 rounded-2xl bg-mustard-soft px-4 py-3 text-sm">
          ✨ This recipe is new and hasn&apos;t been checked yet, so it won&apos;t be suggested for dinners.{" "}
          {isParent ? (
            <Link href={`/recipes/${recipe.slug}/edit`} className="font-semibold underline">
              Check it over and save
            </Link>
          ) : null}
        </p>
      ) : null}

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

      {isParent && aiEnabled() ? (
        <RecipeTweaks
          recipeId={recipe.id}
          proposal={
            proposal
              ? {
                  id: proposal.id,
                  trigger: proposal.trigger,
                  request: proposal.request,
                  summary: proposal.summary,
                  changes: proposal.changes,
                  diff: diffRecipes(recipe, proposal.proposed),
                  newSteps: proposal.proposed.steps.map((s) => s.text),
                }
              : null
          }
          complaints={complaints}
          lastChange={revision?.reason ?? null}
        />
      ) : null}

      <div className="mb-6">
        <NutritionFacts
          nutrition={recipe.nutrition}
          action={isParent && aiEnabled() ? <EstimateNutritionButton id={recipe.id} /> : undefined}
        />
      </div>

      <RecipeView
        recipe={recipe}
        variants={variants}
        heatFor={heatFor}
        sides={sides}
      />

      <RatingsSummary ratings={ratings} members={members} />

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
