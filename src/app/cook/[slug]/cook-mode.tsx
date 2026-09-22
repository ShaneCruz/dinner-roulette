"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { updateNight } from "@/app/(app)/plan/actions";
import { IngredientLine } from "@/app/(app)/recipes/[slug]/recipe-view";
import { formatAmount, scaleIngredient } from "@/lib/recipes/scale";
import type { Recipe, VariantInput } from "@/lib/recipes/schema";
import { ingredientsForStep } from "@/lib/recipes/step-ingredients";
import { askForNotifications, beep, notify, unlockAudio } from "@/lib/timer-alarm";

type Variant = VariantInput & { forNames: string[] };
type Timer = { id: number; step: number; label: string; endsAt: number; ringing: boolean };

export function CookMode({
  recipe,
  variants,
  heatFor,
  startServings,
  tonight,
}: {
  recipe: Recipe & { slug: string };
  variants: Variant[];
  heatFor: string[];
  startServings: number;
  tonight: { date: string; mealId: string } | null;
}) {
  const [servings, setServings] = useState(startServings);
  const [index, setIndex] = useState(-1); // -1 = get ready, steps.length = done
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [awake, setAwake] = useState(false);
  const [made, setMade] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextId = useRef(1);
  const ringers = useRef(new Map<number, ReturnType<typeof setInterval>>());
  const swipe = useRef<number | null>(null);

  const factor = servings / recipe.baseServings;
  const steps = recipe.steps;
  const total = steps.length;
  const ingredients = recipe.ingredients.map((i) => scaleIngredient(i, factor));

  // Keep the screen on the whole time, and take it back after switching apps.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    async function acquire() {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
        else {
          setAwake(true);
          lock.addEventListener("release", () => setAwake(false));
        }
      } catch {
        setAwake(false);
      }
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  // One clock for all timers; it also starts the alarm when one hits zero.
  const timersRef = useRef(timers);
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);
  useEffect(() => {
    if (!timers.length) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      const due = timersRef.current.filter((t) => !t.ringing && t.endsAt <= at && !ringers.current.has(t.id));
      if (!due.length) return;
      setTimers((all) => all.map((t) => (due.some((d) => d.id === t.id) ? { ...t, ringing: true } : t)));
      for (const timer of due) {
        beep();
        navigator.vibrate?.([400, 200, 400, 200, 400]);
        notify(`Step ${timer.step + 1}: ${timer.label}`);
        let rings = 0;
        const ringer = setInterval(() => {
          rings += 1;
          beep();
          navigator.vibrate?.([400, 200, 400]);
          if (rings >= 45) stopRinging(timer.id);
        }, 2500);
        ringers.current.set(timer.id, ringer);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timers.length]);

  useEffect(() => {
    const all = ringers.current;
    return () => all.forEach((r) => clearInterval(r));
  }, []);

  function stopRinging(id: number) {
    const ringer = ringers.current.get(id);
    if (ringer) clearInterval(ringer);
    ringers.current.delete(id);
  }

  function startTimer(step: number, minutes: number) {
    unlockAudio();
    askForNotifications();
    setNow(Date.now());
    setTimers((all) => [
      ...all,
      { id: nextId.current++, step, label: steps[step].text.slice(0, 60), endsAt: Date.now() + minutes * 60_000, ringing: false },
    ]);
  }

  function dismiss(id: number) {
    stopRinging(id);
    setTimers((all) => all.filter((t) => t.id !== id));
  }

  const go = (to: number) => setIndex(Math.max(-1, Math.min(total, to)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const step = index >= 0 && index < total ? steps[index] : null;
  const mentioned = step ? ingredientsForStep(step.text, recipe.ingredients) : [];
  const running = timers.find((t) => t.step === index);

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      onPointerDown={(e) => {
        swipe.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (swipe.current === null) return;
        const dx = e.clientX - swipe.current;
        swipe.current = null;
        if (dx < -80) go(index + 1);
        if (dx > 80) go(index - 1);
      }}
    >
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/recipes/${recipe.slug}`} aria-label="Leave cooking mode" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg">
            ✕
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold leading-tight">{recipe.title}</p>
            <p className="text-xs text-muted">
              {index < 0 ? "Get ready" : index >= total ? "Done!" : `Step ${index + 1} of ${total}`}
              {awake ? " · ☀️ screen stays on" : ""}
            </p>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-2xl gap-1" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= index ? "bg-tomato" : "bg-surface-muted")} />
          ))}
        </div>
        {timers.length ? (
          <ul className="mx-auto mt-2 flex max-w-2xl flex-wrap gap-2" aria-label="Timers">
            {timers.map((t) => {
              const left = Math.max(0, t.endsAt - now);
              const hours = Math.floor(left / 3_600_000);
              const mins = Math.floor((left % 3_600_000) / 60_000);
              const secs = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0");
              const clock = hours ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
              return (
                <li key={t.id} className={cx("flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-semibold", t.ringing ? "animate-pulse bg-tomato text-white" : "bg-mustard-soft")}>
                  <button type="button" onClick={() => go(t.step)}>
                    ⏲ Step {t.step + 1} · {t.ringing ? "Done!" : clock}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className={cx("rounded-full px-2", t.ringing ? "bg-white text-tomato-strong" : "text-muted")}
                    aria-label={t.ringing ? "Stop the alarm" : "Cancel timer"}
                  >
                    {t.ringing ? "Stop" : "✕"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {index < 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">Gather everything</h1>
              <div className="flex items-center gap-2" aria-label="Servings">
                <button type="button" className="h-10 w-10 rounded-full bg-surface-muted text-xl" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">
                  −
                </button>
                <span className="min-w-16 text-center font-semibold">{servings} serv.</span>
                <button type="button" className="h-10 w-10 rounded-full bg-surface-muted text-xl" onClick={() => setServings(Math.min(40, servings + 1))} aria-label="More servings">
                  +
                </button>
              </div>
            </div>
            <ul className="space-y-3 text-lg">
              {ingredients.map((ingredient, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1.5 h-6 w-6 shrink-0 accent-basil"
                      checked={checked.has(i)}
                      onChange={() => {
                        const next = new Set(checked);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        setChecked(next);
                      }}
                    />
                    <IngredientLine ingredient={ingredient} done={checked.has(i)} />
                  </label>
                </li>
              ))}
            </ul>
            {recipe.spiceSplit || variants.some((v) => v.forNames.length) ? (
              <div className="space-y-2 rounded-2xl bg-plum-soft p-4">
                <p className="font-bold">Heads up for tonight</p>
                {recipe.spiceSplit ? (
                  <p>
                    🌶️ Extra heat{heatFor.length ? ` for ${heatFor.join(", ")}` : ""}: {recipe.spiceSplit}
                  </p>
                ) : null}
                {variants
                  .filter((v) => v.forNames.length)
                  .map((v, i) => (
                    <p key={i}>
                      <span className="font-semibold">
                        {v.label} for {v.forNames.join(", ")}:
                      </span>{" "}
                      {v.description}
                      {v.extraSteps.length ? ` (${v.extraSteps.join(" ")})` : ""}
                    </p>
                  ))}
              </div>
            ) : null}
            {recipe.indoorMethod ? <p className="rounded-2xl bg-surface-muted p-3 text-sm">❄️ Cooking indoors? {recipe.indoorMethod}</p> : null}
          </div>
        ) : step ? (
          <div className="space-y-6">
            <p className="text-sm font-bold uppercase tracking-widest text-tomato-strong">Step {index + 1}</p>
            <p className="text-2xl leading-snug sm:text-3xl">{step.text}</p>
            {step.timerMinutes ? (
              running ? (
                <p className="text-lg font-semibold text-muted">⏲ Timer running (see the top of the screen)</p>
              ) : (
                <button
                  type="button"
                  onClick={() => startTimer(index, step.timerMinutes!)}
                  className="w-full rounded-2xl bg-mustard py-4 text-xl font-bold text-foreground shadow-sm"
                >
                  ▶ Start {step.timerMinutes} min timer
                </button>
              )
            ) : null}
            {mentioned.length ? (
              <div className="rounded-2xl bg-surface-muted p-4">
                <p className="text-sm font-bold text-muted">You&apos;ll need</p>
                <ul className="mt-1 space-y-1 text-lg">
                  {mentioned.map((i) => (
                    <li key={i}>
                      {ingredients[i].unit === "to_taste" ? "" : <strong>{formatAmount(ingredients[i])} </strong>}
                      {ingredients[i].name}
                      {ingredients[i].note ? <span className="text-muted">, {ingredients[i].note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5 py-10 text-center">
            <p className="text-7xl" aria-hidden>
              🎉
            </p>
            <h1 className="text-3xl font-bold">Dinner is served!</h1>
            <p className="text-muted">Go get &apos;em, chef.</p>
            {tonight ? (
              made ? (
                <Link href={`/rate/${tonight.mealId}`} className="inline-block rounded-full bg-tomato px-6 py-3 text-lg font-bold text-white">
                  ⭐ Rate it after dinner
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await updateNight(tonight.date, { status: "cooked" });
                      if (!result?.error) setMade(true);
                    })
                  }
                  className="rounded-full bg-basil px-6 py-3 text-lg font-bold text-white"
                >
                  {pending ? "Saving…" : "✓ We made it"}
                </button>
              )
            ) : null}
            <p>
              <Link href={`/recipes/${recipe.slug}`} className="font-semibold text-tomato underline">
                Back to the recipe
              </Link>
            </p>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index < 0}
            className="h-14 flex-1 rounded-2xl bg-surface-muted text-lg font-bold disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= total}
            className="h-14 flex-[2] rounded-2xl bg-tomato text-lg font-bold text-white disabled:opacity-40"
          >
            {index < 0 ? "Start cooking →" : index === total - 1 ? "Finish 🎉" : "Next step →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
