import { notFound } from "next/navigation";
import { db } from "@/db";
import { loadAudience } from "@/lib/members";
import { heatSeekers, variantAudience } from "@/lib/recipes/audience";
import { formatAmount, scaleIngredient } from "@/lib/recipes/scale";
import { COOK_METHOD_LABELS } from "@/lib/recipes/schema";
import { getRecipe } from "@/lib/recipes/store";
import { requireActingMember } from "@/lib/session";
import { PrintControls } from "./print-controls";

export const metadata = { title: "Print recipe" };

export default async function PrintRecipePage({
  params,
  searchParams,
}: PageProps<"/recipes/[slug]/print">) {
  await requireActingMember();
  const recipe = await getRecipe(db, { slug: (await params).slug });
  if (!recipe) notFound();

  const requested = Number((await searchParams).servings);
  const servings = Number.isInteger(requested) && requested > 0 && requested <= 40 ? requested : recipe.baseServings;
  const factor = servings / recipe.baseServings;
  const audience = await loadAudience();
  const heatFor = heatSeekers(audience).map((m) => m.name);

  return (
    <div className="mx-auto max-w-3xl bg-surface p-6 print:max-w-none print:p-0">
      <PrintControls slug={recipe.slug} servings={servings} />
      <header className="border-b-2 border-foreground pb-3">
        <h1 className="text-3xl font-bold">{recipe.title}</h1>
        <p className="mt-1 text-sm">
          {servings} servings · {recipe.activeMinutes} min hands-on · {recipe.totalMinutes} min total ·{" "}
          {COOK_METHOD_LABELS[recipe.method]}
        </p>
      </header>

      <div className="mt-4 grid grid-cols-[2fr_3fr] gap-6">
        <section>
          <h2 className="mb-2 text-lg font-bold">Ingredients</h2>
          <ul className="space-y-1 text-sm">
            {recipe.ingredients.map((ingredient, index) => {
              const scaled = scaleIngredient(ingredient, factor);
              const toTaste = ingredient.unit === "to_taste";
              const amount = toTaste ? "" : formatAmount(scaled);
              return (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>☐</span>
                  <span>
                    {amount ? <strong>{amount} </strong> : null}
                    {ingredient.name}
                    {toTaste ? ", to taste" : ""}
                    {ingredient.note ? `, ${ingredient.note}` : ""}
                    {ingredient.optional ? " (optional)" : ""}
                  </span>
                </li>
              );
            })}
          </ul>

          {recipe.spiceSplit || recipe.variants.length > 0 ? (
            <div className="mt-5 space-y-2 border-t border-border pt-3 text-xs">
              <h2 className="text-sm font-bold">Variations</h2>
              {recipe.spiceSplit ? (
                <p>
                  <strong>Extra heat{heatFor.length ? ` (${heatFor.join(", ")})` : ""}:</strong> {recipe.spiceSplit}
                </p>
              ) : null}
              {recipe.variants.map((variant, index) => {
                const forNames = variantAudience(recipe, variant, audience).map((m) => m.name);
                return (
                  <p key={index}>
                    <strong>
                      {variant.label}
                      {forNames.length ? ` (${forNames.join(", ")})` : ""}:
                    </strong>{" "}
                    {variant.description}
                    {variant.adds.length
                      ? ` Add: ${variant.adds.map((i) => `${formatAmount(scaleIngredient(i, factor))} ${i.name}`.trim()).join(", ")}.`
                      : ""}
                  </p>
                );
              })}
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Steps</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                {step.text}
                {step.timerMinutes ? <em> ({step.timerMinutes} min)</em> : null}
              </li>
            ))}
          </ol>
          {recipe.indoorMethod ? (
            <p className="mt-3 text-xs">
              <strong>Indoors:</strong> {recipe.indoorMethod}
            </p>
          ) : null}
          {recipe.notes ? (
            <p className="mt-3 whitespace-pre-line text-xs">
              <strong>Notes:</strong> {recipe.notes}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
