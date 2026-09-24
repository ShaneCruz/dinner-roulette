"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import type { RestaurantDish } from "@/db/schema";

const TAG_LABELS: Record<string, string> = {
  spicy: "🌶️ Spicy",
  mild: "Mild",
  kid_friendly: "Kid friendly",
  vegetarian: "Vegetarian",
  high_protein: "High protein",
  lighter: "Lighter",
  shareable: "To share",
  gluten_free: "Gluten free",
};

const SHOWN = 15;

/**
 * The menu, with the family's usuals pulled to the top. A real menu runs to a
 * hundred items, which is a wall on a phone, so the rest waits behind a tap.
 */
export function MenuList({ dishes, usuals }: { dishes: RestaurantDish[]; usuals: string[] }) {
  const [all, setAll] = useState(false);
  const isUsual = (name: string) => usuals.includes(name);
  const sorted = [...dishes].sort((a, b) => Number(isUsual(b.name)) - Number(isUsual(a.name)));
  const shown = all ? sorted : sorted.slice(0, SHOWN);

  return (
    <>
      <ul className="mt-3 divide-y divide-border">
        {shown.map((dish) => (
          <li key={dish.name} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">
                {isUsual(dish.name) ? "⭐ " : ""}
                {dish.name}
              </span>
              {dish.price ? <span className="max-w-[45%] text-right text-sm text-muted">{dish.price}</span> : null}
            </div>
            {dish.description ? <p className="text-sm text-muted">{dish.description}</p> : null}
            {dish.tags.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {dish.tags.map((tag) => (
                  <Badge key={tag} tone={tag === "spicy" ? "tomato" : tag === "mild" || tag === "kid_friendly" ? "basil" : "neutral"}>
                    {TAG_LABELS[tag] ?? tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {sorted.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mt-3 w-full rounded-2xl border border-border py-2 text-sm font-semibold text-tomato"
        >
          {all ? "Show fewer" : `Show all ${sorted.length} items`}
        </button>
      ) : null}
    </>
  );
}
