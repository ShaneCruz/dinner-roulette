import Link from "next/link";
import { RecipeCard } from "@/components/recipe-card";
import { ButtonLink, PageHeader, cx, inputClass } from "@/components/ui";
import { db } from "@/db";
import { say } from "@/lib/copy";
import { listRecipes } from "@/lib/recipes/store";
import { requireActingMember } from "@/lib/session";

export const metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const { acting } = await requireActingMember();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const kind = params.kind === "side" ? "side" : params.kind === "all" ? undefined : "main";
  const recipes = await listRecipes(db, { search, kind });

  const tabs = [
    { id: "main", label: "Dinners" },
    { id: "side", label: "Sides" },
    { id: "all", label: "Everything" },
  ];
  const currentTab = kind ?? "all";
  const tabHref = (id: string) => `/recipes?kind=${id}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Recipe box"
        subtitle={`${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
        actions={
          acting.role === "parent" ? (
            <>
              <ButtonLink href="/recipes/import">📷 Add a recipe</ButtonLink>
              <ButtonLink href="/recipes/import?mode=surprise" variant="secondary">
                🎲 Surprise us
              </ButtonLink>
            </>
          ) : null
        }
      />

      <form className="mb-4" role="search">
        <input type="hidden" name="kind" value={currentTab} />
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
        <p className="py-12 text-center text-muted">{say("noRecipesFound", acting.humorDial)}</p>
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
