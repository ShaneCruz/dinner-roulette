"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, inputClass } from "@/components/ui";
import type { NightRanking, NightView, RecipeOption } from "@/lib/plan/view";
import { TIME_BUDGETS, formatDay } from "@/lib/plan/week";
import { daysBetween } from "@/lib/presence";

export function RecipePicker({
  night,
  options,
  onClose,
  onPick,
  plannedThisWeek,
  ranking,
  favoredName,
}: {
  night: NightView;
  options: RecipeOption[];
  /** Engine's view of every dinner for this night */
  ranking: NightRanking;
  favoredName: string | null;
  onClose: () => void;
  onPick: (recipeId: string, sideRecipeIds: string[]) => void;
  /** Dinners already on other nights this week, by recipe id */
  plannedThisWeek: Map<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [mainId, setMainId] = useState<string | null>(night.recipeId);
  const [sideIds, setSideIds] = useState<string[]>(night.sideRecipeIds);
  const [step, setStep] = useState<"main" | "sides">("main");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const term = search.trim().toLowerCase();
  const rank = new Map(ranking.map((r, i) => [r.recipeId, { ...r, position: i }]));
  const mains = options
    .filter((o) => o.kind === "main" && (!term || o.title.toLowerCase().includes(term)))
    .sort((a, b) => (rank.get(a.id)?.position ?? 999) - (rank.get(b.id)?.position ?? 999));
  const fits = mains.filter((o) => !rank.get(o.id)?.excluded);
  const tooLong = mains.filter((o) => rank.get(o.id)?.excluded);
  const sides = useMemo(() => options.filter((o) => o.kind === "side"), [options]);
  const main = options.find((o) => o.id === mainId);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Dinner for ${formatDay(night.date)}`}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{formatDay(night.date, "long")}</p>
            <h2 className="text-2xl font-bold">{step === "main" ? "What's for dinner?" : "Any sides?"}</h2>
            <p className="text-sm text-muted">
              {TIME_BUDGETS[night.timeBudget].short} · {TIME_BUDGETS[night.timeBudget].hint}
              {favoredName && step === "main" ? ` · 🎯 ${favoredName}'s turn` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full text-2xl text-muted hover:bg-surface-muted" aria-label="Close">
            ×
          </button>
        </div>

        {step === "main" ? (
          <>
            <input
              className={cx(inputClass, "mb-3")}
              type="search"
              placeholder="Search dinners…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="-mx-2 flex-1 overflow-y-auto px-2">
              <OptionList
                title="Best fits tonight"
                items={fits}
                rank={rank}
                selectedId={mainId}
                night={night}
                plannedThisWeek={plannedThisWeek}
                onSelect={(id) => {
                  setMainId(id);
                  setStep("sides");
                }}
              />
              {tooLong.length > 0 ? (
                <OptionList
                  title="Doesn't fit tonight"
                  items={tooLong}
                  rank={rank}
                  selectedId={mainId}
                  night={night}
                  plannedThisWeek={plannedThisWeek}
                  muted
                  onSelect={(id) => {
                    setMainId(id);
                    setStep("sides");
                  }}
                />
              ) : null}
              {mains.length === 0 ? <p className="py-8 text-center text-muted">No dinners match “{search}”.</p> : null}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 font-semibold">{main?.title}</p>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {sides.map((side) => {
                  const on = sideIds.includes(side.id);
                  return (
                    <button
                      key={side.id}
                      type="button"
                      onClick={() => setSideIds(on ? sideIds.filter((s) => s !== side.id) : [...sideIds, side.id])}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold",
                        on ? "border-basil bg-basil-soft text-basil" : "border-border text-muted",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {side.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("main")}>
                Back
              </Button>
              <Button type="button" onClick={() => mainId && onPick(mainId, sideIds)}>
                {sideIds.length ? "Plan it" : "No sides, plan it"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OptionList({
  title,
  items,
  selectedId,
  night,
  muted = false,
  onSelect,
  plannedThisWeek,
  rank,
}: {
  title: string;
  items: RecipeOption[];
  rank: Map<string, { reason: string | null; excluded: string | null; position: number }>;
  selectedId: string | null;
  night: NightView;
  plannedThisWeek: Map<string, string>;
  muted?: boolean;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => {
          const ago = item.lastCooked ? daysBetween(item.lastCooked, night.date) : null;
          const alsoOn = plannedThisWeek.get(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface-muted",
                  selectedId === item.id && "bg-tomato-soft",
                  muted && "opacity-70",
                )}
              >
                <span className="flex-1">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-xs text-muted">
                    {item.activeMinutes} min hands-on
                    {item.totalMinutes - item.activeMinutes >= 30 ? ` · ${formatTotal(item.totalMinutes)} total` : ""}
                    {ago !== null ? ` · made ${ago === 1 ? "yesterday" : `${ago} days ago`}` : ""}
                  </span>
                  {alsoOn ? (
                    <span className="block text-xs font-semibold text-mustard">Already on {formatDay(alsoOn)} this week</span>
                  ) : rank.get(item.id)?.excluded ? (
                    <span className="block text-xs font-semibold text-tomato-strong">{rank.get(item.id)!.excluded}</span>
                  ) : rank.get(item.id)?.reason ? (
                    <span className="block text-xs font-semibold text-plum">✨ {rank.get(item.id)!.reason}</span>
                  ) : null}
                </span>
                {item.healthCategory === "healthy" ? <Badge tone="basil">Healthy</Badge> : null}
                {item.seasonFit === "cold" ? <Badge tone="plum">Cozy</Badge> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatTotal(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const halfHours = Math.round(minutes / 30) / 2;
  const whole = Math.floor(halfHours);
  return `${whole}${halfHours - whole ? "½" : ""}h`;
}
