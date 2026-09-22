"use client";

import { useState, useTransition } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import { updateAiBudget } from "./actions";

const LABELS: Record<string, string> = {
  "recipe import": "Adding recipes (photos, PDFs, links)",
  nutrition: "Nutrition facts",
  "side ideas": "Side suggestions",
  "side recipe": "Writing new sides",
  "discover ideas": "Discover ideas",
  "discover recipe": "Writing Discover recipes",
  "recipe tweak": "Recipe tweaks",
  "restaurant research": "Restaurant menus (web search)",
  "restaurant picks": "Restaurant dish picks",
  "calendar import": "School calendar",
  "recipe from description": "Recipes from a description",
  "surprise recipe": "Surprise recipes",
};

const money = (cents: number) => (cents > 0 && cents < 1 ? "under 1¢" : `$${(cents / 100).toFixed(2)}`);

export function AiBudget({
  budgetCents,
  spentCents,
  byFeature,
}: {
  budgetCents: number;
  spentCents: number;
  byFeature: { feature: string; cents: number; calls: number }[];
}) {
  const [value, setValue] = useState((budgetCents / 100).toString());
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const share = budgetCents > 0 ? Math.min(1, spentCents / budgetCents) : 1;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">🤖 AI budget</h2>
        <p className="text-sm font-semibold">
          {money(spentCents)} of {money(budgetCents)} this week
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-muted" aria-label={`${Math.round(share * 100)}% used`}>
        <div
          className={cx("h-full rounded-full", share >= 1 ? "bg-tomato" : share >= 0.8 ? "bg-mustard" : "bg-basil")}
          style={{ width: `${Math.max(share * 100, 2)}%` }}
        />
      </div>
      <p className="text-sm text-muted">
        AI features pause for the rest of the week when this runs out. Planning, groceries, wheels and ratings don&apos;t use
        AI and always work. Automatic jobs (like filling in nutrition) stop at 80% so there&apos;s room for what you ask for.
      </p>
      {byFeature.length ? (
        <ul className="space-y-1 text-sm">
          {byFeature.map((f) => (
            <li key={f.feature} className="flex justify-between gap-3">
              <span>
                {LABELS[f.feature] ?? f.feature} <span className="text-muted">({f.calls})</span>
              </span>
              <span className="font-semibold">{money(f.cents)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing spent yet this week.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">
          Weekly budget ($)
          <input className={cx(inputClass, "mt-1 w-28")} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await updateAiBudget(Number(value));
                setStatus("error" in result ? result.error : "Saved.");
              } catch {
                setStatus("That didn't save. Reload and try again.");
              }
            })
          }
        >
          Save
        </Button>
        {status ? <span className="text-sm text-muted">{status}</span> : null}
      </div>
      <p className="text-xs text-muted">Set it to 0 to turn AI off entirely.</p>
    </Card>
  );
}
