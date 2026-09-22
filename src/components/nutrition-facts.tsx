import type { Nutrition } from "@/db/schema";
import { Card } from "@/components/ui";

/** Approximate nutrition for one serving, big and simple. */
export function NutritionFacts({ nutrition, action }: { nutrition: Nutrition | null; action?: React.ReactNode }) {
  if (!nutrition) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>🥗 Nutrition facts are on the way (they&apos;re estimated after a recipe is saved).</span>
        {action}
      </Card>
    );
  }
  const big = [
    { label: "calories", value: `${nutrition.calories}` },
    { label: "protein", value: `${nutrition.proteinG}g` },
    { label: "carbs", value: `${nutrition.carbsG}g` },
    { label: "fiber", value: `${nutrition.fiberG}g` },
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Nutrition per serving</h2>
        <span className="text-xs text-muted">Approximate · AI estimate from the ingredients</span>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {big.map((b) => (
          <div key={b.label} className="rounded-2xl bg-surface-muted px-1 py-2">
            <dd className="text-xl font-bold sm:text-2xl">{b.value}</dd>
            <dt className="text-xs text-muted">{b.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        Fat {nutrition.fatG}g · Sodium {nutrition.sodiumMg.toLocaleString()}mg
        {nutrition.note ? ` · ${nutrition.note}` : ""}
      </p>
    </Card>
  );
}
