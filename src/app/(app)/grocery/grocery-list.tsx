"use client";

import { useState } from "react";
import { Avatar, Button, Card, cx, inputClass } from "@/components/ui";
import { formatGroceryAmount } from "@/lib/grocery/build";
import { guessSection } from "@/lib/grocery/guess-section";
import type { GrocerySnapshot } from "@/lib/grocery/store";
import { neededBy, useGrocerySync } from "@/lib/grocery/sync";
import { useStoredChoice } from "@/lib/dismissed";
import { addDays } from "@/lib/presence";
import { formatDay } from "@/lib/plan/week";
import { STORE_SECTIONS, STORE_SECTION_LABELS, type StoreSection } from "@/lib/recipes/schema";

type Member = { id: string; name: string; emoji: string; color: string };
type Item = GrocerySnapshot["items"][number];

const WINDOWS = ["soon", "week", "all"] as const;
type Window = (typeof WINDOWS)[number];

export function GroceryList({
  weekPlanId,
  initial,
  actingId,
  members,
  today,
  dates,
}: {
  weekPlanId: string;
  initial: GrocerySnapshot;
  actingId: string;
  members: Member[];
  /** Today, for "the next few nights" */
  today: string;
  /** The week's nights, first to last */
  dates: string[];
}) {
  const { snapshot, change, online, pendingCount } = useGrocerySync(weekPlanId, initial, actingId);
  const [newItem, setNewItem] = useState("");
  const [showStaples, setShowStaples] = useState(false);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const [window, setWindow] = useStoredChoice<Window>("cruz-meals-shopping-window", "week", WINDOWS);
  const from = dates[0] && today > dates[0] ? today : dates[0];
  const soonUntil = addDays(from ?? today, 2);
  const cutoff = window === "soon" ? soonUntil : window === "week" ? dates[dates.length - 1] : null;
  // Things you added yourself have no night, so they're always on the list.
  const inWindow = (item: Item) => {
    const needed = neededBy(item);
    return !cutoff || !needed || needed <= cutoff;
  };

  const active = snapshot.items.filter((i) => !i.isStale);
  const toBuy = active.filter((i) => !i.isStaple && inWindow(i));
  const later = active.filter((i) => !i.isStaple && !inWindow(i));
  const staples = active.filter((i) => i.isStaple);
  const stale = snapshot.items.filter((i) => i.isStale);
  const done = toBuy.filter((i) => i.checked).length;
  const windowLabels: Record<Window, string> = {
    soon: `Next 3 nights (through ${formatDay(soonUntil)})`,
    week: "The whole week",
    all: "Everything, including later weeks",
  };

  const sections = STORE_SECTIONS.map((section) => ({
    section,
    items: toBuy
      .filter((i) => i.section === section)
      .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
  })).filter((s) => s.items.length > 0);

  function addItem() {
    const name = newItem.trim();
    if (!name) return;
    change({ op: "add", id: crypto.randomUUID(), name, quantity: null, unit: "whole", section: guessSection(name) });
    setNewItem("");
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {done} of {toBuy.length} in the cart
          </span>
          <span className={cx("text-xs", online ? "text-muted" : "font-semibold text-tomato-strong")}>
            {!online
              ? `Offline${pendingCount ? ` · ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync` : " · still works"}`
              : pendingCount
                ? "Syncing…"
                : "Live"}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-basil transition-all"
            style={{ width: `${toBuy.length ? (done / toBuy.length) * 100 : 0}%` }}
          />
        </div>
        {toBuy.length > 0 && done === toBuy.length ? (
          <p className="mt-2 text-center font-bold text-basil">🎉 Everything&apos;s in the cart. Go home and cook something.</p>
        ) : null}
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Shopping for</span>
        {WINDOWS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={window === id}
            onClick={() => setWindow(id)}
            className={cx(
              "rounded-full border px-3 py-1 font-semibold",
              window === id ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border text-muted",
            )}
          >
            {id === "soon" ? "Next 3 nights" : id === "week" ? "This week" : "Everything"}
          </button>
        ))}
      </div>
      <p className="no-print -mt-2 text-xs text-muted">{windowLabels[window]}. Anything you skip stays for the next trip.</p>

      <form
        className="no-print flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
      >
        <input
          className={inputClass}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add something (milk, paper towels…)"
          aria-label="Add an item"
        />
        <Button type="submit" variant="secondary" disabled={!newItem.trim()}>
          Add
        </Button>
      </form>

      {sections.map(({ section, items }) => {
        const claim = snapshot.claims.find((c) => c.section === section);
        const claimer = claim ? memberById.get(claim.memberId) : null;
        const mine = claim?.memberId === actingId;
        const allDone = items.every((i) => i.checked);
        return (
          <Card key={section} className={cx("p-0", allDone && "opacity-60")}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-lg font-bold">
                {STORE_SECTION_LABELS[section as StoreSection]}
                {allDone ? " ✓" : ""}
              </h2>
              <button
                type="button"
                onClick={() => change({ op: "claim", section: section as StoreSection, claim: !mine })}
                className={cx(
                  "no-print flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  claimer ? "bg-plum-soft text-plum" : "bg-surface-muted text-muted",
                )}
              >
                {claimer ? (
                  <>
                    <Avatar emoji={claimer.emoji} color={claimer.color} size="sm" className="h-5 w-5 text-xs" />
                    {mine ? "You've got this" : `${claimer.name}'s aisle`}
                  </>
                ) : (
                  "I'll get this aisle"
                )}
              </button>
            </div>
            <ul>
              {items.map((item) => (
                <GroceryRow
                  key={item.id}
                  item={item}
                  checker={item.checkedByMemberId ? memberById.get(item.checkedByMemberId) : undefined}
                  onToggle={() => change({ op: "check", id: item.id, checked: !item.checked })}
                  onRemove={item.isManual ? () => change({ op: "remove", id: item.id }) : undefined}
                />
              ))}
            </ul>
          </Card>
        );
      })}

      {toBuy.length === 0 ? (
        <p className="py-8 text-center text-muted">Nothing to buy yet. Plan some dinners and this fills itself in.</p>
      ) : null}

      {staples.length > 0 ? (
        <Card className="p-0">
          <button
            type="button"
            onClick={() => setShowStaples(!showStaples)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            aria-expanded={showStaples}
          >
            <span>
              <span className="text-lg font-bold">Check you have these</span>
              <span className="block text-xs text-muted">
                Salt, oil, spices and friends ({staples.length}). Grab any you&apos;re out of.
              </span>
            </span>
            <span aria-hidden>{showStaples ? "▾" : "▸"}</span>
          </button>
          {showStaples ? (
            <ul className="border-t border-border">
              {staples.map((item) => (
                <GroceryRow
                  key={item.id}
                  item={item}
                  checker={item.checkedByMemberId ? memberById.get(item.checkedByMemberId) : undefined}
                  onToggle={() => change({ op: "check", id: item.id, checked: !item.checked })}
                />
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {later.length > 0 ? (
        <details className="no-print rounded-2xl border border-dashed border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            🕑 For later this week ({later.length} {later.length === 1 ? "item" : "items"})
          </summary>
          <ul className="mt-2">
            {later
              .sort((a, b) => (neededBy(a) ?? "").localeCompare(neededBy(b) ?? "") || a.name.localeCompare(b.name))
              .map((item) => (
                <GroceryRow
                  key={item.id}
                  item={item}
                  checker={item.checkedByMemberId ? memberById.get(item.checkedByMemberId) : undefined}
                  onToggle={() => change({ op: "check", id: item.id, checked: !item.checked })}
                />
              ))}
          </ul>
        </details>
      ) : null}

      {stale.length > 0 ? (
        <Card className="border-dashed">
          <p className="text-sm font-semibold">Already in the cart, but the plan changed</p>
          <p className="text-xs text-muted">These aren&apos;t needed for this week&apos;s dinners anymore.</p>
          <ul className="mt-2 text-sm text-muted">
            {stale.map((item) => (
              <li key={item.id} className="line-through">
                {item.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function GroceryRow({
  item,
  checker,
  onToggle,
  onRemove,
}: {
  item: Item;
  checker?: Member;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const amount = formatGroceryAmount(item);
  const usedIn = [...new Set(item.sources.map((s) => s.recipeTitle))];
  const needed = neededBy(item);
  return (
    <li className="flex items-center border-b border-border last:border-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex flex-1 items-center gap-4 px-4 py-3.5 text-left active:bg-surface-muted"
      >
        <span
          className={cx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-bold transition",
            item.checked ? "border-basil bg-basil text-white" : "border-border",
          )}
          aria-hidden
        >
          {item.checked ? "✓" : ""}
        </span>
        <span className={cx("min-w-0 flex-1", item.checked && "text-muted line-through")}>
          <span className="block text-lg leading-tight">
            {amount ? <strong className="font-semibold">{amount} </strong> : null}
            {item.name}
          </span>
          {usedIn.length > 0 ? (
            <span className="block truncate text-xs text-muted" title={item.sources.map((s) => `${s.recipeTitle} (${formatDay(s.date)})`).join(", ")}>
              for {usedIn.join(", ")}
              {needed ? ` · ${formatDay(needed)}` : ""}
            </span>
          ) : null}
        </span>
        {item.checked && checker ? (
          <span className="shrink-0 text-lg" title={`Checked by ${checker.name}`} aria-label={`Checked by ${checker.name}`}>
            {checker.emoji}
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="no-print px-4 py-3 text-xl text-muted hover:text-tomato" aria-label={`Remove ${item.name}`}>
          ×
        </button>
      ) : null}
    </li>
  );
}
