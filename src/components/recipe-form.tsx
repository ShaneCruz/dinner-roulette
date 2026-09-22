"use client";

import { useState, useTransition } from "react";
import { saveRecipeAction } from "@/app/(app)/recipes/actions";
import { Button, Card, Field, cx, inputClass } from "@/components/ui";
import { emptyIngredient, emptyVariant } from "@/lib/recipes/blank";
import {
  COOK_METHODS,
  COOK_METHOD_LABELS,
  HEALTH_LABELS,
  RECIPE_TAGS,
  RECIPE_TAG_LABELS,
  SEASON_LABELS,
  STORE_SECTIONS,
  STORE_SECTION_LABELS,
  UNITS,
  VARIANT_KINDS,
  VARIANT_KIND_LABELS,
  type IngredientInput,
  type Recipe,
  type StepInput,
  type VariantInput,
} from "@/lib/recipes/schema";

const UNIT_LABELS: Record<(typeof UNITS)[number], string> = {
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  fl_oz: "fl oz",
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  whole: "(count)",
  clove: "clove",
  slice: "slice",
  can: "can",
  jar: "jar",
  package: "package",
  bunch: "bunch",
  head: "head",
  stalk: "stalk",
  sprig: "sprig",
  pinch: "pinch",
  to_taste: "to taste",
};


export function RecipeForm({
  initial,
  existingId,
  initialNotes,
  sides,
}: {
  initial: Recipe;
  existingId: string | null;
  initialNotes: string | null;
  sides: { slug: string; title: string }[];
}) {
  const [recipe, setRecipe] = useState<Recipe>(initial);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Recipe>(key: K, value: Recipe[K]) => setRecipe({ ...recipe, [key]: value });
  const ingredientNames = [...new Set(recipe.ingredients.map((i) => i.name).filter(Boolean))];

  function submit() {
    setError(null);
    const cleaned: Recipe = {
      ...recipe,
      ingredients: recipe.ingredients.filter((i) => i.name.trim()),
      steps: recipe.steps.filter((s) => s.text.trim()),
      variants: recipe.variants.map((v) => ({
        ...v,
        adds: v.adds.filter((i) => i.name.trim()),
        extraSteps: v.extraSteps.filter((s) => s.trim()),
      })),
    };
    startTransition(async () => {
      const result = await saveRecipeAction(cleaned, existingId, notes.trim() || null);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">The basics</h2>
        <Field label="Name">
          <input
            className={inputClass}
            value={recipe.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Grandma's Sunday Sauce"
            required
          />
        </Field>
        <Field label="Description" hint="One or two sentences. A little humor is welcome.">
          <textarea
            className={inputClass}
            rows={2}
            value={recipe.description}
            onChange={(e) => set("description", e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select
              className={inputClass}
              value={recipe.kind}
              onChange={(e) => set("kind", e.target.value as Recipe["kind"])}
            >
              <option value="main">Dinner</option>
              <option value="side">Side</option>
            </select>
          </Field>
          <Field label="Cuisine">
            <input className={inputClass} value={recipe.cuisine} onChange={(e) => set("cuisine", e.target.value)} />
          </Field>
          <Field label="Cooked with">
            <select
              className={inputClass}
              value={recipe.method}
              onChange={(e) => set("method", e.target.value as Recipe["method"])}
            >
              {COOK_METHODS.map((m) => (
                <option key={m} value={m}>
                  {COOK_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Hands-on minutes" value={recipe.activeMinutes} min={1} onChange={(v) => set("activeMinutes", v)} />
          <NumberField
            label="Total minutes"
            hint="Including simmering or slow cooking"
            value={recipe.totalMinutes}
            min={1}
            onChange={(v) => set("totalMinutes", v)}
          />
          <NumberField label="Servings" value={recipe.baseServings} min={1} onChange={(v) => set("baseServings", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Healthiness">
            <select
              className={inputClass}
              value={recipe.healthCategory}
              onChange={(e) => set("healthCategory", e.target.value as Recipe["healthCategory"])}
            >
              {Object.entries(HEALTH_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Season">
            <select
              className={inputClass}
              value={recipe.seasonFit}
              onChange={(e) => set("seasonFit", e.target.value as Recipe["seasonFit"])}
            >
              {Object.entries(SEASON_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Repeat after (days)" hint="Blank uses the family default">
            <input
              className={inputClass}
              type="number"
              min={1}
              value={recipe.cooldownDays ?? ""}
              onChange={(e) => set("cooldownDays", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {RECIPE_TAGS.map((tag) => {
              const on = recipe.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => set("tags", on ? recipe.tags.filter((t) => t !== tag) : [...recipe.tags, tag])}
                  className={cx(
                    "rounded-full border px-3 py-1 text-sm font-semibold",
                    on ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border bg-surface text-muted",
                  )}
                >
                  {RECIPE_TAG_LABELS[tag]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Heat &amp; weather</h2>
        <Field label={`Spice level: ${["none", "mild", "medium", "hot"][recipe.spiceLevel]}`}>
          <input
            type="range"
            min={0}
            max={3}
            value={recipe.spiceLevel}
            onChange={(e) => set("spiceLevel", Number(e.target.value))}
            className="w-full accent-tomato"
          />
        </Field>
        <Field label="Extra heat for some people" hint="How to add spice to only some portions. Leave blank if it can't be split.">
          <input
            className={inputClass}
            value={recipe.spiceSplit ?? ""}
            onChange={(e) => set("spiceSplit", e.target.value || null)}
            placeholder="Hot sauce and pickled jalapeños at the table"
          />
        </Field>
        <Field label="Indoor fallback" hint="For grilled recipes: what to do when it's freezing or pouring.">
          <input
            className={inputClass}
            value={recipe.indoorMethod ?? ""}
            onChange={(e) => set("indoorMethod", e.target.value || null)}
            placeholder="Cast-iron skillet, 4 minutes per side"
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Ingredients</h2>
        <IngredientRows
          rows={recipe.ingredients}
          onChange={(rows) => set("ingredients", rows)}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Steps</h2>
        <p className="text-sm text-muted">Short and plain. Assume whoever cooks is tired and hungry.</p>
        <ol className="space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-right font-bold text-muted">{index + 1}.</span>
              <div className="flex-1 space-y-2">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={step.text}
                  onChange={(e) => set("steps", replaceAt(recipe.steps, index, { ...step, text: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  Timer
                  <input
                    type="number"
                    min={1}
                    className={cx(inputClass, "w-24 py-1.5")}
                    value={step.timerMinutes ?? ""}
                    onChange={(e) =>
                      set(
                        "steps",
                        replaceAt<StepInput>(recipe.steps, index, {
                          text: step.text,
                          ...(e.target.value ? { timerMinutes: Number(e.target.value) } : {}),
                        }),
                      )
                    }
                  />
                  min
                </label>
              </div>
              <RemoveButton onClick={() => set("steps", recipe.steps.filter((_, i) => i !== index))} />
            </li>
          ))}
        </ol>
        <Button type="button" variant="secondary" size="sm" onClick={() => set("steps", [...recipe.steps, { text: "" }])}>
          + Add step
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Variations</h2>
          <p className="text-sm text-muted">
            Healthy swaps, mild versions, or a different protein for someone who skips an ingredient.
          </p>
        </div>
        {recipe.variants.map((variant, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Field label="Kind">
                <select
                  className={inputClass}
                  value={variant.kind}
                  onChange={(e) =>
                    set("variants", replaceAt(recipe.variants, index, { ...variant, kind: e.target.value as VariantInput["kind"] }))
                  }
                >
                  {VARIANT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {VARIANT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={variant.label}
                  onChange={(e) => set("variants", replaceAt(recipe.variants, index, { ...variant, label: e.target.value }))}
                  placeholder="Zucchini noodles"
                />
              </Field>
              <div className="flex items-end">
                <RemoveButton onClick={() => set("variants", recipe.variants.filter((_, i) => i !== index))} />
              </div>
            </div>
            <Field label="What changes">
              <input
                className={inputClass}
                value={variant.description}
                onChange={(e) => set("variants", replaceAt(recipe.variants, index, { ...variant, description: e.target.value }))}
              />
            </Field>
            {ingredientNames.length > 0 ? (
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Leave out</legend>
                <div className="flex flex-wrap gap-2">
                  {ingredientNames.map((name) => {
                    const on = variant.removes.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          set(
                            "variants",
                            replaceAt(recipe.variants, index, {
                              ...variant,
                              removes: on ? variant.removes.filter((r) => r !== name) : [...variant.removes, name],
                            }),
                          )
                        }
                        className={cx(
                          "rounded-full border px-3 py-1 text-sm",
                          on ? "border-tomato bg-tomato-soft line-through" : "border-border",
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            <div>
              <p className="mb-1.5 text-sm font-semibold">Add instead</p>
              <IngredientRows
                rows={variant.adds}
                onChange={(rows) => set("variants", replaceAt(recipe.variants, index, { ...variant, adds: rows }))}
                compact
              />
            </div>
            <Field label="Extra steps" hint="One per line">
              <textarea
                className={inputClass}
                rows={2}
                value={variant.extraSteps.join("\n")}
                onChange={(e) =>
                  set("variants", replaceAt(recipe.variants, index, { ...variant, extraSteps: e.target.value.split("\n") }))
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Extra hands-on minutes"
                value={variant.extraActiveMinutes}
                min={0}
                onChange={(v) => set("variants", replaceAt(recipe.variants, index, { ...variant, extraActiveMinutes: v }))}
              />
              <Field label="Lets someone avoid" hint="Comma separated, e.g. ground beef">
                <input
                  className={inputClass}
                  value={variant.avoids.join(", ")}
                  onChange={(e) =>
                    set(
                      "variants",
                      replaceAt(recipe.variants, index, {
                        ...variant,
                        avoids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      }),
                    )
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => set("variants", [...recipe.variants, emptyVariant()])}>
          + Add variation
        </Button>
      </Card>

      {recipe.kind === "main" && sides.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Goes with</h2>
          <div className="flex flex-wrap gap-2">
            {sides.map((side) => {
              const on = recipe.pairsWith.includes(side.slug);
              return (
                <button
                  key={side.slug}
                  type="button"
                  onClick={() =>
                    set("pairsWith", on ? recipe.pairsWith.filter((s) => s !== side.slug) : [...recipe.pairsWith, side.slug])
                  }
                  className={cx(
                    "rounded-full border px-3 py-1 text-sm font-semibold",
                    on ? "border-basil bg-basil-soft text-basil" : "border-border text-muted",
                  )}
                >
                  {side.title}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card>
        <Field label="Family notes" hint="Anything worth remembering: “double the garlic”, “Brayden likes extra cheese”.">
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-20 flex justify-end sm:bottom-4">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lg">
          {pending ? "Saving…" : "Save recipe"}
        </Button>
      </div>
    </form>
  );
}

function IngredientRows({
  rows,
  onChange,
  compact = false,
}: {
  rows: IngredientInput[];
  onChange: (rows: IngredientInput[]) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className={cx(
            // On a phone: amount, unit and remove on one line, then the name,
            // note and section full width so nothing is cut off.
            "grid grid-cols-[5rem_1fr_auto] gap-2 rounded-2xl sm:grid-cols-[5rem_7rem_1fr_1fr_9rem_auto]",
            !compact && "border border-border p-2 sm:border-0 sm:p-0",
          )}
        >
          <input
            className={cx(inputClass, "px-3")}
            type="number"
            step="any"
            min={0}
            aria-label="Amount"
            placeholder="Amt"
            value={row.quantity ?? ""}
            disabled={row.unit === "to_taste"}
            onChange={(e) => onChange(replaceAt(rows, index, { ...row, quantity: e.target.value ? Number(e.target.value) : null }))}
          />
          <select
            className={cx(inputClass, "px-2")}
            aria-label="Unit"
            value={row.unit}
            onChange={(e) => {
              const unit = e.target.value as IngredientInput["unit"];
              onChange(replaceAt(rows, index, { ...row, unit, quantity: unit === "to_taste" ? null : (row.quantity ?? 1) }));
            }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
          <input
            className={cx(inputClass, "col-span-3 sm:col-span-1")}
            aria-label="Ingredient"
            placeholder="yellow onion"
            value={row.name}
            onChange={(e) => onChange(replaceAt(rows, index, { ...row, name: e.target.value.toLowerCase() }))}
          />
          <input
            className={cx(inputClass, "col-span-3 sm:col-span-1")}
            aria-label="Note"
            placeholder="diced (optional)"
            value={row.note ?? ""}
            onChange={(e) => {
              const { note: _note, ...rest } = row;
              onChange(replaceAt(rows, index, e.target.value ? { ...rest, note: e.target.value } : rest));
            }}
          />
          <select
            className={cx(inputClass, "col-span-3 px-2 sm:col-span-1")}
            aria-label="Store section"
            value={row.section}
            onChange={(e) => onChange(replaceAt(rows, index, { ...row, section: e.target.value as IngredientInput["section"] }))}
          >
            {STORE_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {STORE_SECTION_LABELS[s]}
              </option>
            ))}
          </select>
          <RemoveButton
            className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          />
          {!compact ? (
            <div className="col-span-3 flex flex-wrap gap-4 text-sm text-muted sm:col-span-6">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-tomato"
                  checked={row.perishable}
                  onChange={(e) => onChange(replaceAt(rows, index, { ...row, perishable: e.target.checked }))}
                />
                Goes bad within a week
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-tomato"
                  checked={row.optional ?? false}
                  onChange={(e) => {
                    const { optional: _optional, ...rest } = row;
                    onChange(replaceAt(rows, index, e.target.checked ? { ...rest, optional: true } : rest));
                  }}
                />
                Optional
              </label>
            </div>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...rows, emptyIngredient()])}>
        + Add ingredient
      </Button>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

function RemoveButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("h-11 w-9 shrink-0 rounded-full text-xl text-muted hover:bg-tomato-soft hover:text-tomato", className)}
      aria-label="Remove"
    >
      ×
    </button>
  );
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}
