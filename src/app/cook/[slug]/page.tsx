import { notFound } from "next/navigation";
import { db } from "@/db";
import { loadAudience } from "@/lib/members";
import { eatersFor, loadEaterContext, loadMeals, servingsFor } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { heatSeekers, variantAudience } from "@/lib/recipes/audience";
import { getRecipe } from "@/lib/recipes/store";
import { requireActingMember } from "@/lib/session";
import { aiEnabled } from "@/lib/ai/claude";
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

  // Everything else on tonight's plate, so the sides can be timed with the main.
  const alsoTonight =
    isTonight && tonight
      ? (
          await Promise.all(
            [tonight.recipeId, ...tonight.sideRecipeIds]
              .filter((id): id is string => Boolean(id) && id !== recipe.id)
              .map((id) => getRecipe(db, { id })),
          )
        ).filter((r): r is NonNullable<typeof r> => Boolean(r))
      : [];
  const dish = (r: { id: string; title: string; slug: string; steps: typeof recipe.steps; activeMinutes: number; totalMinutes: number }) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    steps: r.steps,
    activeMinutes: r.activeMinutes,
    totalMinutes: r.totalMinutes,
  });

  return (
    <CookMode
      recipe={recipe}
      variants={recipe.variants.map((v) => ({ ...v, forNames: variantAudience(recipe, v, audience).map((m) => m.name) }))}
      heatFor={recipe.spiceSplit ? heatSeekers(audience).map((m) => m.name) : []}
      startServings={servings}
      dishes={[dish(recipe), ...alsoTonight.map(dish)]}
      dinnerTime={settings.dinnerTime}
      recipeId={recipe.id}
      canAsk={aiEnabled()}
      isParent={acting.role === "parent"}
      tonight={isTonight && tonight.status === "planned" && acting.role === "parent" ? { date: today, mealId: tonight.id } : null}
    />
  );
}
