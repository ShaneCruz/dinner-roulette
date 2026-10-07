import Link from "next/link";
import { RecipeCard } from "@/components/recipe-card";
import { ButtonLink, PageHeader, cx, inputClass } from "@/components/ui";
import { db } from "@/db";
import { say } from "@/lib/copy";
import { getRecipe, listRecipes } from "@/lib/recipes/store";
import { loadMeals } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { requireActingMember } from "@/lib/session";
import { aiEnabled } from "@/lib/ai/claude";
import { AskForDinner } from "./ask-for-dinner";
import { scheduleOn } from "@/lib/sports/store";

export const metadata = { title: "Recipes" };

// Asking for dinner ideas waits on Claude for a few seconds.
export const maxDuration = 60;

/** What's on for tonight, so picking something else can say it replaces it. */
async function tonightsDinner(timezone: string): Promise<string | null> {
  const today = todayIn(timezone);
  const tonight = (await loadMeals(db, today, today)).get(today);
  if (tonight?.nightType !== "cook" || !tonight.recipeId || tonight.status === "skipped") return null;
  return (await getRecipe(db, { id: tonight.recipeId }))?.title ?? null;
}

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const { acting, settings } = await requireActingMember();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const kind = params.kind === "side" ? "side" : params.kind === "all" ? undefined : "main";
  const archivedOnly = params.show === "archived";
  const [recipes, archivedCount] = await Promise.all([
    listRecipes(db, { search, kind: archivedOnly ? undefined : kind, onlyArchived: archivedOnly }),
    listRecipes(db, { onlyArchived: true }).then((all) => all.length),
  ]);

  const tabs = [
    { id: "main", label: "Dinners" },
    { id: "side", label: "Sides" },
    { id: "all", label: "Everything" },
    ...(archivedCount ? [{ id: "archived", label: `Archived (${archivedCount})` }] : []),
  ];
  const currentTab = archivedOnly ? "archived" : kind ?? "all";
  const tabHref = (id: string) =>
    `/recipes?${id === "archived" ? "show=archived" : `kind=${id}`}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Recipe box"
        subtitle={
          archivedOnly
            ? "Retired recipes. Open one and tap Restore to bring it back."
            : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`
        }
        actions={
          acting.role === "parent" ? (
            <>
              <ButtonLink href="/recipes/import">📷 Add a recipe</ButtonLink>
              <ButtonLink href="/recipes/discover" variant="secondary">
                💘 Discover dinners
              </ButtonLink>
              <ButtonLink href="/recipes/import?mode=surprise" variant="secondary">
                🎲 Surprise us
              </ButtonLink>
            </>
          ) : null
        }
      />

      {acting.role === "parent" && aiEnabled() && !archivedOnly ? (
        <AskForDinner
          night={todayIn(settings.timezone)}
          today={todayIn(settings.timezone)}
          tonightTitle={await tonightsDinner(settings.timezone)}
          schedule={await scheduleOn(db, settings, todayIn(settings.timezone))}
        />
      ) : null}

      <form className="mb-4" role="search">
        <input type="hidden" name={archivedOnly ? "show" : "kind"} value={archivedOnly ? "archived" : currentTab} />
        <input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search recipes or ingredients…"
          className={inputClass}
        />
      </form>

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(tab.id)}
            className={cx(
              "rounded-full px-4 py-1.5 text-sm font-semibold",
              currentTab === tab.id ? "bg-foreground text-background" : "bg-surface-muted text-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {recipes.length === 0 ? (
        <p className="py-12 text-center text-muted">
          {archivedOnly ? "Nothing archived." : say("noRecipesFound", acting.humorDial)}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
