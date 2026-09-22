"use client";

import { isLockedPick } from "@/lib/fun/card-info";
import { mealNutrition, nutritionLine } from "@/lib/nutrition";
import { SideRecommender } from "./side-recommender";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar, Badge, Button, Card, cx } from "@/components/ui";
import type { NightRanking, NightView, RecipeOption } from "@/lib/plan/view";
import { weatherEmoji } from "@/lib/weather";
import {
  NIGHT_TYPES,
  TIME_BUDGETS,
  fitsBudget,
  formatDay,
  type NightType,
  type TimeBudget,
} from "@/lib/plan/week";
import {
  anotherIdeaAction,
  clearNightAction,
  discardBumpedAction,
  placeBumpedAction,
  skipNightAction,
  suggestWeekAction,
  swapNightsAction,
  updateNight,
} from "./actions";
import { RecipePicker } from "./recipe-picker";

export type BoardMember = { id: string; name: string; emoji: string; color: string };
type Bumped = { id: string; fromDate: string; title: string; slug: string };

export function PlanBoard({
  nights,
  options,
  bumped,
  rankings,
  restaurants,
  weekStart,
  members,
  today,
  canEdit,
  weeknightActiveMinutes,
}: {
  nights: NightView[];
  options: RecipeOption[];
  bumped: Bumped[];
  rankings: Record<string, NightRanking>;
  restaurants: { id: string; name: string }[];
  weekStart: string;
  members: BoardMember[];
  today: string;
  canEdit: boolean;
  weeknightActiveMinutes: number;
}) {
  const [picking, setPicking] = useState<NightView | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const run = (work: () => Promise<{ error: string } | void>) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await work();
        if (result?.error) setError(result.error);
      } catch {
        setError("That didn't save. Reload the page and try again.");
      }
    });

  const futureNights = nights.filter((n) => n.date >= today);
  const openNights = futureNights.filter(
    (n) => n.nightType === "cook" && !n.recipeId && n.status !== "skipped" && n.status !== "cooked",
  ).length;
  const [notice, setNotice] = useState<string | null>(null);
  const cookedMeals = nights
    .filter((n) => n.nightType === "cook" && n.recipeId && n.status !== "skipped")
    .map((n) => {
      const main = byId.get(n.recipeId!);
      return main ? mealNutrition([main.nutrition, ...n.sideRecipeIds.map((id) => byId.get(id)?.nutrition)]) : null;
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const weekAverage = cookedMeals.length >= 2
    ? {
        calories: Math.round(cookedMeals.reduce((a, m) => a + m.calories, 0) / cookedMeals.length),
        proteinG: Math.round(cookedMeals.reduce((a, m) => a + m.proteinG, 0) / cookedMeals.length),
        carbsG: Math.round(cookedMeals.reduce((a, m) => a + m.carbsG, 0) / cookedMeals.length),
        fiberG: Math.round(cookedMeals.reduce((a, m) => a + m.fiberG, 0) / cookedMeals.length),
      }
    : null;

  return (
    <div className={cx("space-y-4", pending && "opacity-70 transition-opacity")}>
      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}

      {canEdit && openNights > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-plum-soft to-surface">
          <div>
            <p className="font-bold">
              {openNights} open {openNights === 1 ? "night" : "nights"} this week
            </p>
            <p className="text-sm text-muted">
              Let the planner pick, based on who&apos;s home, time, ratings, and whose turn it is.
            </p>
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await suggestWeekAction(weekStart);
                if ("error" in result) return result;
                setNotice(
                  result.filled
                    ? `Planned ${result.filled} ${result.filled === 1 ? "dinner" : "dinners"}. Tap ↻ on any night for another idea.`
                    : "Couldn't find dinners that fit. Try more time or fewer rules.",
                );
              })
            }
          >
            ✨ Suggest dinners
          </Button>
        </Card>
      ) : null}
      {notice ? <p className="rounded-2xl bg-basil-soft px-4 py-3 text-sm text-basil">{notice}</p> : null}

      {weekAverage ? (
        <p className="text-sm text-muted">
          🥗 Planned dinners average <span className="font-semibold text-foreground">{nutritionLine(weekAverage)}</span> per
          person (approximate).
        </p>
      ) : null}

      {bumped.length > 0 ? (
        <Card className="border-mustard bg-mustard-soft">
          <h2 className="font-bold">Bumped dinners</h2>
          <p className="text-sm text-muted">Skipped, but the groceries are probably in the fridge. Put them on a night.</p>
          <ul className="mt-3 space-y-2">
            {bumped.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/recipes/${b.slug}`} className="font-semibold underline-offset-2 hover:underline">
                  {b.title}
                </Link>
                <span className="text-xs text-muted">from {formatDay(b.fromDate)}</span>
                {canEdit ? (
                  <span className="ml-auto flex gap-2">
                    <select
                      className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                      defaultValue=""
                      aria-label={`Move ${b.title} to a night`}
                      onChange={(e) => e.target.value && run(() => placeBumpedAction(b.id, e.target.value))}
                    >
                      <option value="" disabled>
                        Put on…
                      </option>
                      {futureNights.map((n) => (
                        <option key={n.date} value={n.date}>
                          {formatDay(n.date)}
                          {n.recipeId ? " (replaces dinner)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button type="button" size="sm" variant="ghost" onClick={() => run(() => discardBumpedAction(b.id))}>
                      Toss
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nights.map((night) => (
          <li key={night.date}>
            <NightCard
              night={night}
              recipe={night.recipeId ? byId.get(night.recipeId) ?? null : null}
              sides={night.sideRecipeIds.map((id) => byId.get(id)).filter((s): s is RecipeOption => Boolean(s))}
              members={members}
              isToday={night.date === today}
              isPast={night.date < today}
              canEdit={canEdit}
              weeknightActiveMinutes={weeknightActiveMinutes}
              otherNights={nights.filter((n) => n.date !== night.date)}
              restaurantName={restaurants.find((r) => r.id === night.restaurantId)?.name ?? null}
              onPick={() => setPicking(night)}
              run={run}
            />
          </li>
        ))}
      </ol>

      {picking ? (
        <RecipePicker
          night={picking}
          options={options}
          ranking={rankings[picking.date] ?? []}
          favoredName={members.find((m) => m.id === picking.favoredMemberId)?.name ?? null}
          plannedThisWeek={
            new Map(
              nights
                .filter((n) => n.date !== picking.date && n.recipeId && n.status !== "skipped")
                .map((n) => [n.recipeId!, n.date]),
            )
          }
          onClose={() => setPicking(null)}
          onPick={(recipeId, sideRecipeIds) => {
            const date = picking.date;
            setPicking(null);
            run(() => updateNight(date, { recipeId, sideRecipeIds }));
          }}
        />
      ) : null}
    </div>
  );
}

function NightCard({
  night,
  recipe,
  sides,
  members,
  isToday,
  isPast,
  canEdit,
  weeknightActiveMinutes,
  otherNights,
  restaurantName,
  onPick,
  run,
}: {
  night: NightView;
  restaurantName: string | null;
  recipe: RecipeOption | null;
  sides: RecipeOption[];
  members: BoardMember[];
  isToday: boolean;
  isPast: boolean;
  canEdit: boolean;
  weeknightActiveMinutes: number;
  otherNights: NightView[];
  onPick: () => void;
  run: (work: () => Promise<{ error: string } | void>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cooking = night.nightType === "cook";
  const tooLong = recipe && !fitsBudget(recipe, night.timeBudget, weeknightActiveMinutes);
  const eating = new Set(night.eatingIds);
  const favored = members.find((m) => m.id === night.favoredMemberId) ?? null;
  const todayRef = useRef<HTMLDivElement>(null);
  const meal = recipe ? mealNutrition([recipe.nutrition, ...sides.map((side) => side.nutrition)]) : null;
  // Anyone can spin for an open night or one the planner picked; hand-picked dinners are the parents' call.
  const spinnable =
    cooking &&
    !isPast &&
    night.status !== "cooked" &&
    night.status !== "skipped" &&
    (!recipe || (Boolean(night.suggestionReason) && !isLockedPick(night.suggestionReason)));

  useEffect(() => {
    if (isToday) todayRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [isToday]);

  // Past nights shrink to one line; tap to open them back up.
  if (isPast && !expanded) {
    const label = !cooking
      ? `${NIGHT_TYPES[night.nightType].emoji} ${NIGHT_TYPES[night.nightType].label}`
      : recipe?.title ?? "Nothing planned";
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-3xl border border-border bg-surface-muted px-5 py-3 text-left"
      >
        <span className="w-24 shrink-0 text-sm font-bold text-muted">{formatDay(night.date)}</span>
        <span className={cx("flex-1 truncate", night.status === "skipped" && "line-through")}>{label}</span>
        {night.status === "cooked" ? <Badge tone="basil">✓</Badge> : null}
      </button>
    );
  }

  const toggleEater = (id: string) => {
    const next = eating.has(id) ? night.eatingIds.filter((x) => x !== id) : [...night.eatingIds, id];
    // Back to "whoever is home" when it matches the calendar again.
    const same = next.length === night.homeIds.length && next.every((x) => night.homeIds.includes(x));
    run(() => updateNight(night.date, { eaterIds: same ? null : next }));
  };

  return (
    <Card
      ref={todayRef}
      className={cx(
        "flex h-full scroll-mt-24 flex-col gap-3",
        isToday && "border-tomato ring-2 ring-tomato/30",
        night.status === "skipped" && "opacity-60",
        isPast && night.status !== "cooked" && "bg-surface-muted",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {isToday ? "Tonight" : " "}
            {weatherEmoji(night.weather) ? (
              <span className="ml-1 normal-case tracking-normal" title={`${Math.round(night.weather!.tempMaxF)}°F, ${night.weather!.precipChance}% rain`}>
                {weatherEmoji(night.weather)} {Math.round(night.weather!.tempMaxF)}°
              </span>
            ) : null}
          </p>
          <h2 className="text-lg font-bold">{formatDay(night.date, "long")}</h2>
          {cooking && favored ? (
            <p className="mt-0.5 text-xs font-semibold text-plum">🎯 {favored.name}&apos;s turn</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {night.status === "cooked" ? <Badge tone="basil">✓ Cooked</Badge> : null}
          {night.status === "skipped" ? <Badge>Skipped</Badge> : null}
          {canEdit ? (
            <div className="relative">
              <button
                type="button"
                className="h-9 w-9 rounded-full text-xl text-muted hover:bg-surface-muted"
                aria-label={`More for ${formatDay(night.date)}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                ⋯
              </button>
              {menuOpen ? (
                <NightMenu
                  night={night}
                  otherNights={otherNights}
                  hasDinner={Boolean(recipe)}
                  onClose={() => setMenuOpen(false)}
                  run={run}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canEdit && !recipe ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Kind of night">
          {(Object.keys(NIGHT_TYPES) as NightType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => type !== night.nightType && run(() => updateNight(night.date, { nightType: type, status: "planned" }))}
              className={cx(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                night.nightType === type ? "bg-foreground text-background" : "bg-surface-muted text-muted hover:text-foreground",
              )}
            >
              {NIGHT_TYPES[type].emoji} {NIGHT_TYPES[type].label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1">
        {!cooking ? (
          <div className="py-3 text-center">
            <p className="text-2xl font-bold">
              {NIGHT_TYPES[night.nightType].emoji} {NIGHT_TYPES[night.nightType].label}
            </p>
            {night.nightType === "takeout" ? (
              restaurantName && night.restaurantId ? (
                <Link href={`/takeout/${night.restaurantId}`} className="mt-1 block font-semibold text-tomato">
                  from {restaurantName} →
                </Link>
              ) : (
                <Link href={`/takeout/spin?date=${night.date}`} className="mt-2 inline-block rounded-full bg-tomato-soft px-4 py-1.5 text-sm font-semibold text-tomato-strong">
                  🎡 Spin for a place
                </Link>
              )
            ) : null}
          </div>
        ) : recipe ? (
          <div>
            <Link href={`/recipes/${recipe.slug}`} className="text-xl font-bold leading-tight hover:underline">
              {recipe.title}
            </Link>
            {night.status !== "skipped" ? (
              <SideRecommender
                date={night.date}
                sides={sides.map((side) => ({ id: side.id, slug: side.slug, title: side.title }))}
                canEdit={canEdit && night.status === "planned"}
              />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={tooLong ? "tomato" : "basil"}>⏱ {recipe.activeMinutes} min hands-on</Badge>
              {recipe.totalMinutes - recipe.activeMinutes >= 60 ? (
                <Badge tone="plum">Start {Math.round(recipe.totalMinutes / 60)}h early</Badge>
              ) : null}
              {recipe.healthCategory === "healthy" ? <Badge tone="basil">Healthy</Badge> : null}
              {recipe.healthCategory === "comfort" ? <Badge tone="mustard">Comfort</Badge> : null}
            </div>
            {meal ? <p className="mt-2 text-xs font-semibold text-basil">{nutritionLine(meal)}{meal.complete ? "" : " (main only)"}</p> : null}
            {night.suggestionReason ? (
              <p className="mt-2 text-sm text-muted">✨ {night.suggestionReason}</p>
            ) : null}
            {tooLong ? (
              <p className="mt-2 text-xs text-tomato-strong">
                Takes more time than tonight has ({TIME_BUDGETS[night.timeBudget].hint.toLowerCase()}).
              </p>
            ) : null}
            {canEdit && night.status === "planned" ? (
              <div className="mt-2 flex gap-4">
                <button type="button" onClick={onPick} className="text-sm font-semibold text-tomato">
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => run(() => anotherIdeaAction(night.date))}
                  className="text-sm font-semibold text-plum"
                >
                  ↻ Another idea
                </button>
                <Link href={`/plan/spin?date=${night.date}`} className="text-sm font-semibold text-foreground">
                  🎡 Spin
                </Link>
              </div>
            ) : !canEdit && spinnable ? (
              <Link href={`/plan/spin?date=${night.date}`} className="mt-2 inline-block text-sm font-semibold text-tomato">
                🎡 Spin the wheel instead
              </Link>
            ) : null}
            {night.status === "cooked" && night.mealId ? (
              <Link href={`/rate/${night.mealId}`} className="mt-2 inline-block text-sm font-semibold text-tomato">
                ⭐ Rate it
              </Link>
            ) : null}
          </div>
        ) : canEdit || spinnable ? (
          <div className="space-y-2">
            {night.suggestionReason ? <p className="text-sm font-semibold">{night.suggestionReason}</p> : null}
            {canEdit ? (
          <button
            type="button"
            onClick={onPick}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-6 text-muted transition hover:border-tomato hover:text-tomato"
          >
            <span className="text-3xl" aria-hidden>
              🍽️
            </span>
            <span className="mt-1 font-semibold">Pick dinner</span>
          </button>
            ) : null}
            {spinnable ? (
              <Link
                href={`/plan/spin?date=${night.date}`}
                className="block rounded-2xl bg-mustard-soft py-2.5 text-center font-semibold text-foreground"
              >
                🎡 Can&apos;t decide? Spin the wheel
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-muted">Nothing planned yet</p>
        )}
      </div>

      {cooking ? (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Time for cooking">
            {(Object.keys(TIME_BUDGETS) as TimeBudget[]).map((budget) => (
              <button
                key={budget}
                type="button"
                disabled={!canEdit}
                title={TIME_BUDGETS[budget].hint}
                onClick={() => run(() => updateNight(night.date, { timeBudget: budget }))}
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-default",
                  night.timeBudget === budget ? "bg-tomato-soft text-tomato-strong" : "text-muted",
                  !canEdit && night.timeBudget !== budget && "hidden",
                )}
              >
                {TIME_BUDGETS[budget].short}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex -space-x-1" role="group" aria-label="Who's eating">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleEater(m.id)}
                  title={`${m.name}: ${eating.has(m.id) ? "eating" : "not eating"}`}
                  aria-pressed={eating.has(m.id)}
                  className={cx(
                    "rounded-full ring-2 ring-surface transition disabled:cursor-default",
                    !eating.has(m.id) && "opacity-25 grayscale",
                  )}
                >
                  <Avatar emoji={m.emoji} color={m.color} size="sm" />
                </button>
              ))}
            </div>
            {night.eaterIds ? <span className="text-xs text-muted">custom</span> : null}
            <ServingsStepper night={night} canEdit={canEdit} run={run} />
          </div>
        </div>
      ) : null}

      {isToday && recipe && canEdit && night.status === "planned" ? (
        <Button type="button" size="sm" onClick={() => run(() => updateNight(night.date, { status: "cooked" }))}>
          ✓ We made it
        </Button>
      ) : null}
    </Card>
  );
}

function ServingsStepper({
  night,
  canEdit,
  run,
}: {
  night: NightView;
  canEdit: boolean;
  run: (work: () => Promise<{ error: string } | void>) => void;
}) {
  const set = (servings: number | null) => run(() => updateNight(night.date, { servings }));
  const extra = night.servings - night.eatingIds.length;
  return (
    <div className="ml-auto flex items-center gap-1 text-sm">
      {canEdit ? (
        <button
          type="button"
          className="h-7 w-7 rounded-full bg-surface-muted font-bold"
          aria-label="Fewer servings"
          onClick={() => set(Math.max(1, night.servings - 1))}
        >
          −
        </button>
      ) : null}
      <span className="min-w-16 text-center font-semibold">
        {night.servings} {night.servings === 1 ? "serving" : "servings"}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="h-7 w-7 rounded-full bg-surface-muted font-bold"
          aria-label="More servings"
          onClick={() => set(night.servings + 1)}
        >
          +
        </button>
      ) : null}
      {extra > 0 ? <Badge tone="basil">+{extra} leftovers</Badge> : null}
      {night.servingsOverridden && canEdit ? (
        <button type="button" className="text-xs text-muted underline" onClick={() => set(null)}>
          auto
        </button>
      ) : null}
    </div>
  );
}

function NightMenu({
  night,
  otherNights,
  hasDinner,
  onClose,
  run,
}: {
  night: NightView;
  otherNights: NightView[];
  hasDinner: boolean;
  onClose: () => void;
  run: (work: () => Promise<{ error: string } | void>) => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const act = (work: () => Promise<{ error: string } | void>) => {
    onClose();
    run(work);
  };
  const item = "block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-muted";

  return (
    <div className="absolute right-0 top-10 z-10 w-60 rounded-2xl border border-border bg-surface p-1.5 shadow-lg">
      {swapping ? (
        <>
          <p className="px-3 py-1 text-xs font-semibold text-muted">Swap dinner with…</p>
          {otherNights.map((other) => (
            <button key={other.date} type="button" className={item} onClick={() => act(() => swapNightsAction(night.date, other.date))}>
              {formatDay(other.date)}
            </button>
          ))}
        </>
      ) : (
        <>
          {night.status !== "cooked" && hasDinner ? (
            <button type="button" className={item} onClick={() => act(() => updateNight(night.date, { status: "cooked" }))}>
              ✓ We made it
            </button>
          ) : null}
          {night.status === "cooked" || night.status === "skipped" ? (
            <button type="button" className={item} onClick={() => act(() => updateNight(night.date, { status: "planned" }))}>
              ↩︎ Back to planned
            </button>
          ) : null}
          {hasDinner && night.status !== "skipped" ? (
            <>
              <button type="button" className={item} onClick={() => act(() => skipNightAction(night.date, true))}>
                ⏭ Skip, save it for later
              </button>
              <button type="button" className={item} onClick={() => act(() => skipNightAction(night.date, false))}>
                ✗ Skip, don&apos;t save
              </button>
            </>
          ) : null}
          <button type="button" className={item} onClick={() => setSwapping(true)}>
            ⇄ Swap with another night
          </button>
          {hasDinner
            ? (Object.keys(NIGHT_TYPES) as NightType[])
                .filter((type) => type !== "cook")
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={item}
                    onClick={() => act(() => updateNight(night.date, { nightType: type, status: "planned" }))}
                  >
                    {NIGHT_TYPES[type].emoji} Make it {NIGHT_TYPES[type].label.toLowerCase()}
                  </button>
                ))
            : null}
          <button type="button" className={item} onClick={() => act(() => clearNightAction(night.date))}>
            🧹 Clear this night
          </button>
        </>
      )}
    </div>
  );
}
