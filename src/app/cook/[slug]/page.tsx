import { notFound } from "next/navigation";
import { db } from "@/db";
import { loadAudience } from "@/lib/members";
import { eatersFor, loadEaterContext, loadMeals, servingsFor } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { heatSeekers, variantAudience } from "@/lib/recipes/audience";
import { getRecipe } from "@/lib/recipes/store";
import { requireActingMember } from "@/lib/session";
import { CookMode } from "./cook-mode";

export async function generateMetadata({ params }: PageProps<"/cook/[slug]">) {
  const found = await getRecipe(db, { slug: (await params).slug });
  return { title: found ? `Cooking: ${found.title}` : "Cooking mode" };
}

export default async function CookPage({ params }: PageProps<"/cook/[slug]">) {
  const { settings, acting } = await requireActingMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();

  const today = todayIn(settings.timezone);
  const [audience, meals, eaterContext] = await Promise.all([
    loadAudience(),
    loadMeals(db, today, today),
    loadEaterContext(db, today, today),
  ]);
  const tonight = meals.get(today);
  const isTonight = tonight?.nightType === "cook" && (tonight.recipeId === recipe.id || tonight.sideRecipeIds.includes(recipe.id));
  const servings = isTonight
    ? servingsFor(tonight, eatersFor(eaterContext, today, tonight.eaterIds).length)
    : recipe.baseServings;

  return (
    <CookMode
      recipe={recipe}
      variants={recipe.variants.map((v) => ({ ...v, forNames: variantAudience(recipe, v, audience).map((m) => m.name) }))}
      heatFor={recipe.spiceSplit ? heatSeekers(audience).map((m) => m.name) : []}
      startServings={servings}
      tonight={isTonight && tonight.status === "planned" && acting.role === "parent" ? { date: today, mealId: tonight.id } : null}
    />
  );
}
