"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, cx } from "@/components/ui";
import { Wheel, type WheelItem } from "@/components/wheel";
import type { RestaurantPick } from "@/db/schema";
import { cuisineEmoji } from "@/lib/cuisine-emoji";
import { weightedIndex } from "@/lib/restaurants/favorites";
import { orderFrom } from "../actions";

type Place = {
  id: string;
  name: string;
  cuisine: string;
  recentDays: number | null;
  picks: RestaurantPick[];
  familyOrder: string | null;
  /** How likely the wheel lands here, from how the people eating feel about it */
  weight: number;
  meh: string[];
  loves: string[];
  usual: {
    lines: { dish: string; count: number; who: string[] }[];
    shared: { dish: string; count: number }[];
    missing: string[];
  } | null;
};
type Member = { id: string; name: string; emoji: string; color: string };

export function TakeoutSpinner({
  date,
  canSave,
  restaurants,
  members,
  preselected,
}: {
  date: string;
  canSave: boolean;
  restaurants: Place[];
  members: Member[];
  preselected: string | null;
}) {
  // Skip places ordered from in the last few days, unless that leaves too few.
  const fresh = restaurants.filter((r) => r.recentDays === null || r.recentDays > 3).map((r) => r.id);
  const [included, setIncluded] = useState<string[]>(fresh.length >= 2 ? fresh : restaurants.map((r) => r.id));
  const [winner, setWinner] = useState<Place | null>(restaurants.find((r) => r.id === preselected) ?? null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onWheel = restaurants.filter((r) => included.includes(r.id));
  const items: WheelItem[] = onWheel.map((r) => ({ id: r.id, label: r.name, emoji: cuisineEmoji(r.cuisine) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Restaurants on the wheel">
        {restaurants.map((r) => {
          const on = included.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setIncluded(on ? included.filter((x) => x !== r.id) : [...included, r.id])}
              aria-pressed={on}
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm font-semibold",
                on ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border text-muted line-through",
              )}
            >
              {cuisineEmoji(r.cuisine)} {r.name}
              {r.loves.length ? <span className="ml-1" title={`${r.loves.join(", ")} love it`}>😍</span> : null}
              {r.meh.length ? <span className="ml-1" title={`${r.meh.join(", ")} isn't a fan`}>😕</span> : null}
              {r.recentDays !== null && r.recentDays <= 7 ? (
                <span className="ml-1 text-xs font-normal">
                  ({r.recentDays === 0 ? "today" : `${r.recentDays}d ago`})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {onWheel.some((r) => r.meh.length || r.loves.length) ? (
        <p className="-mt-3 text-xs text-muted">
          😍 places come up more often, 😕 ones less.{" "}
          {onWheel
            .filter((r) => r.meh.length)
            .map((r) => `${r.meh.join(" & ")} ${r.meh.length > 1 ? "aren't" : "isn't"} big on ${r.name}.`)
            .join(" ")}
        </p>
      ) : null}

      <Wheel
        items={items}
        pickIndex={() => weightedIndex(onWheel.map((r) => r.weight))}
        spinLabel={winner ? "Spin again" : "🎡 Spin!"}
        onResult={(item) => {
          setSaved(false);
          setError(null);
          setWinner(restaurants.find((r) => r.id === item.id) ?? null);
        }}
      />

      {winner ? (
        <Card className="border-mustard bg-mustard-soft">
          <p className="text-sm font-bold uppercase tracking-widest text-muted">The wheel has spoken</p>
          <h2 className="mt-1 text-3xl font-bold">
            {cuisineEmoji(winner.cuisine)} {winner.name}
          </h2>
          {winner.usual && (winner.usual.lines.length || winner.usual.shared.length) ? (
            <div className="mt-3 rounded-2xl bg-surface p-3">
              <p className="text-sm font-bold">Your usual</p>
              <ul className="mt-1 text-sm">
                {winner.usual.lines.map((l) => (
                  <li key={l.dish}>
                    {l.count > 1 ? `${l.count}× ` : ""}
                    {l.dish} <span className="text-muted">({l.who.join(", ")})</span>
                  </li>
                ))}
                {winner.usual.shared.map((s) => (
                  <li key={s.dish}>
                    {s.count > 1 ? `${s.count}× ` : ""}
                    {s.dish} <span className="text-muted">(to share)</span>
                  </li>
                ))}
              </ul>
              {winner.usual.missing.length ? (
                <p className="mt-1 text-xs text-muted">No usual yet for {winner.usual.missing.join(", ")}. Tap &quot;Help me choose&quot; on the order page.</p>
              ) : null}
            </div>
          ) : winner.picks.length ? (
            <ul className="mt-4 space-y-2">
              {members.map((m) => {
                const pick = winner.picks.find((p) => p.memberId === m.id);
                if (!pick) return null;
                return (
                  <li key={m.id} className="flex items-start gap-2">
                    <Avatar emoji={m.emoji} color={m.color} size="sm" />
                    <span>
                      <span className="font-bold">{m.name}:</span> {pick.dish}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No dish picks yet for this place.</p>
          )}
          {winner.familyOrder ? <p className="mt-3 text-sm">🍽️ {winner.familyOrder}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {canSave ? (
              saved ? (
                <p className="font-semibold text-basil">✓ Saved to the plan. Enjoy!</p>
              ) : (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const result = await orderFrom(winner.id, date);
                        if (result?.error) setError(result.error);
                        else setSaved(true);
                      } catch {
                        setError("That didn't save. Reload and try again.");
                      }
                    })
                  }
                >
                  ✓ We&apos;re ordering from here
                </Button>
              )
            ) : null}
            <Link href={`/takeout/${winner.id}`} className="inline-flex h-11 items-center px-3 font-semibold text-tomato">
              Order &amp; help me choose →
            </Link>
          </div>
          {error ? <p className="mt-2 text-sm text-tomato-strong">{error}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
