"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge, Button, Card, cx } from "@/components/ui";
import { formatAmount, scaleIngredient } from "@/lib/recipes/scale";
import { askForNotifications, beep, notify, unlockAudio } from "@/lib/timer-alarm";
import { VARIANT_KIND_LABELS, type IngredientInput, type Recipe, type VariantInput } from "@/lib/recipes/schema";

type ViewVariant = VariantInput & { forNames: string[] };

export function RecipeView({
  recipe,
  variants,
  heatFor,
  sides,
}: {
  recipe: Recipe;
  variants: ViewVariant[];
  heatFor: string[];
  sides: { slug: string; title: string }[];
}) {
  const [servings, setServings] = useState(recipe.baseServings);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const factor = servings / recipe.baseServings;

  const toggle = (set: Set<number>, index: number) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Ingredients</h2>
            <div className="no-print flex items-center gap-2" aria-label="Servings">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-9 px-0"
                onClick={() => setServings(Math.max(1, servings - 1))}
                aria-label="Fewer servings"
              >
                −
              </Button>
              <span className="min-w-20 text-center text-sm font-semibold">
                {servings} {servings === 1 ? "serving" : "servings"}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-9 px-0"
                onClick={() => setServings(Math.min(40, servings + 1))}
                aria-label="More servings"
              >
                +
              </Button>
            </div>
          </div>
          {servings > recipe.baseServings ? (
            <p className="mt-2 text-xs text-basil">Extra for leftovers. Nice planning.</p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="no-print mt-1 h-5 w-5 shrink-0 accent-basil"
                    checked={checkedIngredients.has(index)}
                    onChange={() => setCheckedIngredients(toggle(checkedIngredients, index))}
                  />
                  <IngredientLine
                    ingredient={scaleIngredient(ingredient, factor)}
                    done={checkedIngredients.has(index)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </Card>

        {recipe.spiceSplit || variants.length > 0 ? (
          <Card>
            <h2 className="text-xl font-bold">Make it work for everyone</h2>
            <ul className="mt-3 space-y-3">
              {recipe.spiceSplit ? (
                <li className="rounded-2xl bg-tomato-soft p-3">
                  <p className="font-semibold">
                    🌶️ Extra heat{heatFor.length > 0 ? ` for ${heatFor.join(", ")}` : ""}
                  </p>
                  <p className="text-sm">{recipe.spiceSplit}</p>
                </li>
              ) : null}
              {variants.map((variant, index) => (
                <VariantCard key={index} variant={variant} factor={factor} />
              ))}
            </ul>
          </Card>
        ) : null}

        {sides.length > 0 ? (
          <Card>
            <h2 className="text-xl font-bold">Goes great with</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {sides.map((side) => (
                <li key={side.slug}>
                  <Link
                    href={`/recipes/${side.slug}`}
                    className="inline-block rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold hover:bg-border"
                  >
                    {side.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Steps</h2>
            <KeepAwakeToggle />
          </div>
          {recipe.indoorMethod ? (
            <p className="mt-2 rounded-2xl bg-plum-soft px-3 py-2 text-sm">
              ❄️ Bad weather? Cook it indoors: {recipe.indoorMethod}
            </p>
          ) : null}
          <ol className="mt-4 space-y-4">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDoneSteps(toggle(doneSteps, index))}
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    doneSteps.has(index) ? "bg-basil text-white" : "bg-tomato-soft text-tomato-strong",
                  )}
                  aria-label={`Step ${index + 1}${doneSteps.has(index) ? ", done" : ""}`}
                >
                  {doneSteps.has(index) ? "✓" : index + 1}
                </button>
                <div className={cx("flex-1 pt-1", doneSteps.has(index) && "text-muted line-through")}>
                  <p className="leading-relaxed">{step.text}</p>
                  {step.timerMinutes ? <StepTimer minutes={step.timerMinutes} label={step.text} /> : null}
                </div>
              </li>
            ))}
          </ol>
          {doneSteps.size === recipe.steps.length && recipe.steps.length > 0 ? (
            <p className="mt-6 rounded-2xl bg-basil-soft p-4 text-center text-lg font-bold text-basil">
              🎉 Dinner is served! Go get &apos;em.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export function IngredientLine({ ingredient, done }: { ingredient: IngredientInput; done?: boolean }) {
  const toTaste = ingredient.unit === "to_taste";
  const amount = toTaste ? "" : formatAmount(ingredient);
  return (
    <span className={cx("leading-snug", done && "text-muted line-through")}>
      {amount ? <strong className="font-semibold">{amount} </strong> : null}
      {ingredient.name}
      {toTaste ? <span className="text-muted">, to taste</span> : null}
      {ingredient.note ? <span className="text-muted">, {ingredient.note}</span> : null}
      {ingredient.optional ? <span className="text-muted"> (optional)</span> : null}
    </span>
  );
}

function VariantCard({ variant, factor }: { variant: ViewVariant; factor: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl border border-border p-3">
      <button type="button" className="w-full text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{variant.label}</span>
          <Badge tone={variant.kind === "healthy" ? "basil" : variant.kind === "mild" ? "mustard" : "plum"}>
            {VARIANT_KIND_LABELS[variant.kind]}
          </Badge>
          {variant.forNames.length > 0 ? (
            <span className="text-sm text-muted">for {variant.forNames.join(", ")}</span>
          ) : null}
          <span className="ml-auto text-sm text-muted" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{variant.description}</p>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-sm">
          {variant.removes.length > 0 ? (
            <p>
              <span className="font-semibold">Skip:</span> {variant.removes.join(", ")}
            </p>
          ) : null}
          {variant.adds.length > 0 ? (
            <div>
              <p className="font-semibold">Add:</p>
              <ul className="ml-4 list-disc">
                {variant.adds.map((ingredient, i) => (
                  <li key={i}>
                    <IngredientLine ingredient={scaleIngredient(ingredient, factor)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {variant.extraSteps.length > 0 ? (
            <div>
              <p className="font-semibold">
                Extra steps{variant.extraActiveMinutes ? ` (+${variant.extraActiveMinutes} min)` : ""}:
              </p>
              <ol className="ml-4 list-decimal">
                {variant.extraSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function StepTimer({ minutes, label }: { minutes: number; label: string }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const alarm = useRef<ReturnType<typeof setInterval> | null>(null);
  const rang = useRef(false);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt === null ? minutes * 60_000 : Math.max(0, endsAt - now);
  const finished = endsAt !== null && remaining === 0;

  function stopAlarm() {
    if (alarm.current) clearInterval(alarm.current);
    alarm.current = null;
    if (document.title.startsWith("⏰")) document.title = document.title.replace(/^⏰ Timer done! · /, "");
  }

  useEffect(() => {
    if (!finished || rang.current) return;
    rang.current = true;
    // Keep ringing until someone taps Done (up to about two minutes).
    let rings = 0;
    beep();
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    alarm.current = setInterval(() => {
      rings += 1;
      beep();
      navigator.vibrate?.([400, 200, 400]);
      if (rings >= 45) stopAlarm();
    }, 2500);
    if (!document.title.startsWith("⏰")) document.title = `⏰ Timer done! · ${document.title}`;
    notify(label);
  }, [finished, label]);

  useEffect(() => () => stopAlarm(), []);

  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="no-print mt-2 flex items-center gap-2">
      <span
        className={cx(
          "rounded-full px-3 py-1 font-mono text-sm font-semibold",
          finished ? "animate-pulse bg-tomato text-white" : endsAt ? "bg-mustard-soft" : "bg-surface-muted",
        )}
      >
        ⏲ {mm}:{ss}
      </span>
      {endsAt === null ? (
        <button
          type="button"
          className="text-sm font-semibold text-tomato"
          onClick={() => {
            // Unlock sound now, during the tap; phones block audio that
            // starts later without one.
            unlockAudio();
            askForNotifications();
            rang.current = false;
            setNow(Date.now());
            setEndsAt(Date.now() + minutes * 60_000);
          }}
        >
          Start timer
        </button>
      ) : (
        <button
          type="button"
          className={cx("text-sm font-semibold", finished ? "rounded-full bg-tomato px-3 py-1 text-white" : "text-muted")}
          onClick={() => {
            stopAlarm();
            setEndsAt(null);
          }}
        >
          {finished ? "Done ✓" : "Cancel"}
        </button>
      )}
    </div>
  );
}

const noopSubscribe = () => () => {};

/** Keeps the phone screen on while cooking (Screen Wake Lock API). */
function KeepAwakeToggle() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "wakeLock" in navigator,
    () => false,
  );
  const [lock, setLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!lock) return;
    const onRelease = () => setLock(null);
    lock.addEventListener("release", onRelease);
    return () => {
      lock.removeEventListener("release", onRelease);
    };
  }, [lock]);

  useEffect(() => () => void lock?.release(), [lock]);

  if (!supported) return null;
  return (
    <button
      type="button"
      className={cx(
        "no-print rounded-full px-3 py-1 text-sm font-semibold",
        lock ? "bg-mustard text-foreground" : "bg-surface-muted text-muted",
      )}
      onClick={async () => {
        if (lock) {
          await lock.release();
          setLock(null);
        } else {
          try {
            setLock(await navigator.wakeLock.request("screen"));
          } catch {
            // Denied (low battery, not visible); nothing to do.
          }
        }
      }}
    >
      {lock ? "☀️ Screen stays on" : "Keep screen on"}
    </button>
  );
}
