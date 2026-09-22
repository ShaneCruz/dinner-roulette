"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, cx } from "@/components/ui";
import { Wheel, type WheelItem } from "@/components/wheel";
import type { RestaurantPick } from "@/db/schema";
import { cuisineEmoji } from "@/lib/cuisine-emoji";
import { orderFrom } from "../actions";

type Place = {
  id: string;
  name: string;
  cuisine: string;
  recentDays: number | null;
  picks: RestaurantPick[];
  familyOrder: string | null;
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

  const items: WheelItem[] = restaurants
    .filter((r) => included.includes(r.id))
    .map((r) => ({ id: r.id, label: r.name, emoji: cuisineEmoji(r.cuisine) }));

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
              {r.recentDays !== null && r.recentDays <= 7 ? (
                <span className="ml-1 text-xs font-normal">
                  ({r.recentDays === 0 ? "today" : `${r.recentDays}d ago`})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Wheel
        items={items}
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
          {winner.picks.length ? (
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
              Full menu picks →
            </Link>
          </div>
          {error ? <p className="mt-2 text-sm text-tomato-strong">{error}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
