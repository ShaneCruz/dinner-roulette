"use client";

import { useState, useTransition } from "react";
import { Avatar, Button, Card, cx, inputClass } from "@/components/ui";
import { Wheel } from "@/components/wheel";
import type { RestaurantDish, RestaurantFavorites, RestaurantFeeling, RestaurantPick } from "@/db/schema";
import {
  chooserOptions,
  EMPTY_FAVORITES,
  FEELINGS,
  orderText,
  usualOrder,
  type ChooserTraits,
} from "@/lib/restaurants/favorites";
import { saveFavorites } from "../actions";

type Person = { id: string; name: string; emoji: string; color: string; role: "parent" | "kid"; traits: ChooserTraits };

export function UsualOrder({
  restaurantId,
  restaurantName,
  phone,
  people,
  favorites: saved,
  research,
  actingId,
  isParent,
  eatingIds,
}: {
  restaurantId: string;
  restaurantName: string;
  phone: string | null;
  people: Person[];
  favorites: RestaurantFavorites | null;
  research: { dishes: RestaurantDish[]; picks: RestaurantPick[] } | null;
  actingId: string;
  isParent: boolean;
  eatingIds: string[];
}) {
  const [favorites, setFavorites] = useState<RestaurantFavorites>(saved ?? EMPTY_FAVORITES);
  const [editing, setEditing] = useState(false);
  const [eating, setEating] = useState<string[]>(eatingIds.length ? eatingIds : people.map((p) => p.id));
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasAny = Object.keys(favorites.people).length > 0 || favorites.shared.length > 0;
  const diners = people.filter((p) => eating.includes(p.id));
  const order = usualOrder(favorites, diners, choices);
  const text = orderText(order, restaurantName);

  if (editing) {
    return (
      <FavoritesEditor
        restaurantId={restaurantId}
        people={isParent ? people : people.filter((p) => p.id === actingId)}
        isParent={isParent}
        initial={favorites}
        menu={research?.dishes.map((d) => d.name) ?? []}
        onDone={(next) => {
          if (next) setFavorites(next);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Our usual order</h2>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-tomato">
          ✏️ {hasAny ? "Edit favorites" : "Add favorites"}
        </button>
      </div>

      {!hasAny ? (
        <p className="text-sm text-muted">
          Save everyone&apos;s go-to dishes and what you always get for the table. Then the order adds itself up, and
          anyone stuck can spin for a dish.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" aria-label="Who's eating">
        {people.map((p) => {
          const on = eating.includes(p.id);
          const feeling = favorites.people[p.id]?.feeling;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setEating(on ? eating.filter((x) => x !== p.id) : [...eating, p.id])}
              className={cx(
                "rounded-full border px-3 py-1 text-sm font-semibold",
                on ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border text-muted line-through",
              )}
            >
              {p.emoji} {p.name}
              {feeling ? ` ${FEELINGS[feeling].emoji}` : ""}
            </button>
          );
        })}
      </div>

      <ul className="space-y-3">
        {diners.map((p) => {
          const mine = favorites.people[p.id]?.dishes ?? [];
          const current = choices[p.id] ?? mine[0] ?? null;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <Avatar emoji={p.emoji} color={p.color} size="sm" />
              <span className="font-bold">{p.name}:</span>
              {mine.length > 1 ? (
                <select
                  className="max-w-full rounded-full border border-border bg-surface px-3 py-1 text-sm"
                  value={mine.includes(current ?? "") ? current! : ""}
                  onChange={(e) => setChoices({ ...choices, [p.id]: e.target.value })}
                >
                  {!mine.includes(current ?? "") && current ? <option value="">{current}</option> : null}
                  {mine.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={cx(!current && "text-muted")}>{current ?? "No usual yet"}</span>
              )}
              <button
                type="button"
                onClick={() => setChoosing(choosing === p.id ? null : p.id)}
                className="ml-auto rounded-full bg-mustard-soft px-3 py-1 text-sm font-semibold"
              >
                🎲 Help me choose
              </button>
              {choosing === p.id ? (
                <Chooser
                  person={p}
                  options={chooserOptions(p.id, favorites, research, p.traits)}
                  onPick={(dish) => {
                    setChoices({ ...choices, [p.id]: dish });
                  }}
                  onClose={() => setChoosing(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {order.lines.length || order.shared.length ? (
        <div className="rounded-2xl bg-basil-soft p-4">
          <p className="text-sm font-bold uppercase tracking-widest text-basil">The order</p>
          <ul className="mt-2 space-y-1">
            {order.lines.map((l) => (
              <li key={l.dish}>
                <span className="font-bold">{l.count > 1 ? `${l.count}× ` : ""}</span>
                {l.dish} <span className="text-sm text-muted">({l.who.join(", ")})</span>
              </li>
            ))}
            {order.shared.map((s) => (
              <li key={s}>
                {s} <span className="text-sm text-muted">(to share)</span>
              </li>
            ))}
          </ul>
          {order.missing.length ? (
            <p className="mt-2 text-sm text-muted">Still deciding: {order.missing.join(", ")}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  window.prompt("Copy the order:", text);
                }
              }}
            >
              {copied ? "✓ Copied" : "📋 Copy order"}
            </Button>
            {phone ? (
              <a href={`tel:${phone}`} className="inline-flex h-9 items-center px-3 text-sm font-semibold text-tomato">
                📞 Call it in
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Chooser({
  person,
  options,
  onPick,
  onClose,
}: {
  person: Person;
  options: string[];
  onPick: (dish: string) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  if (options.length < 2) {
    return (
      <div className="w-full rounded-2xl bg-surface-muted p-3 text-sm">
        Not enough options to spin yet. Add a few favorites for {person.name}, or look up the menu.{" "}
        <button type="button" onClick={onClose} className="font-semibold underline">
          OK
        </button>
      </div>
    );
  }
  return (
    <div className="w-full space-y-3 rounded-2xl border border-mustard bg-mustard-soft p-3">
      <p className="text-center font-bold">{person.name}, let fate decide 🎲</p>
      <Wheel
        items={options.map((d, i) => ({ id: `${i}`, label: d }))}
        spinLabel={picked ? "Spin again" : "Spin!"}
        onResult={(item) => {
          const dish = options[Number(item.id)];
          setPicked(dish);
          onPick(dish);
        }}
      />
      {picked ? (
        <p className="text-center">
          <span className="font-bold">{picked}</span> it is!{" "}
          <button type="button" onClick={onClose} className="font-semibold text-tomato underline">
            Done
          </button>
        </p>
      ) : (
        <p className="text-center text-xs text-muted">Favorites plus a few menu ideas that suit {person.name}.</p>
      )}
    </div>
  );
}

function DishList({
  dishes,
  onChange,
  placeholder,
}: {
  dishes: string[];
  onChange: (dishes: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const dish = draft.trim();
    if (dish && !dishes.some((d) => d.toLowerCase() === dish.toLowerCase())) onChange([...dishes, dish]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {dishes.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {dishes.map((d, i) => (
            <li key={d} className="flex items-center gap-1 rounded-full bg-surface-muted py-1 pl-3 pr-1 text-sm">
              {i === 0 && dishes.length > 1 ? <span title="Their usual">⭐</span> : null}
              {d}
              <button
                type="button"
                aria-label={`Remove ${d}`}
                onClick={() => onChange(dishes.filter((x) => x !== d))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          list="menu-dishes"
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

function FavoritesEditor({
  restaurantId,
  people,
  isParent,
  initial,
  menu,
  onDone,
}: {
  restaurantId: string;
  people: Person[];
  isParent: boolean;
  initial: RestaurantFavorites;
  menu: string[];
  onDone: (saved: RestaurantFavorites | null) => void;
}) {
  const [draft, setDraft] = useState<RestaurantFavorites>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kids = people.filter((p) => p.role === "kid");

  const entry = (id: string) => draft.people[id] ?? { dishes: [], feeling: null };
  const setEntry = (id: string, next: { dishes: string[]; feeling: RestaurantFeeling | null }) =>
    setDraft((d) => ({ ...d, people: { ...d.people, [id]: next } }));

  return (
    <Card className="space-y-5">
      <datalist id="menu-dishes">
        {menu.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div>
        <h2 className="text-xl font-bold">Edit favorites</h2>
        <p className="text-sm text-muted">The first dish is their usual (⭐). Add more if they switch it up.</p>
      </div>
      {people.map((p) => {
        const mine = entry(p.id);
        return (
          <div key={p.id} className="space-y-2 border-t border-border pt-4 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Avatar emoji={p.emoji} color={p.color} size="sm" />
              <span className="font-bold">{p.name}</span>
              <div className="ml-auto flex gap-1" role="group" aria-label={`How ${p.name} feels about this place`}>
                {(Object.keys(FEELINGS) as RestaurantFeeling[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    title={FEELINGS[f].label}
                    aria-label={FEELINGS[f].label}
                    aria-pressed={mine.feeling === f}
                    onClick={() => setEntry(p.id, { ...mine, feeling: mine.feeling === f ? null : f })}
                    className={cx(
                      "h-9 w-9 rounded-full text-lg",
                      mine.feeling === f ? "bg-tomato-soft ring-2 ring-tomato" : "bg-surface-muted opacity-60",
                    )}
                  >
                    {FEELINGS[f].emoji}
                  </button>
                ))}
              </div>
            </div>
            <DishList
              dishes={mine.dishes}
              placeholder={`${p.name}'s go-to dish`}
              onChange={(dishes) => setEntry(p.id, { ...mine, dishes })}
            />
            {isParent && p.role === "kid" && kids.length > 1 && mine.dishes.length ? (
              <button
                type="button"
                className="text-sm font-semibold text-plum"
                onClick={() => {
                  for (const k of kids) if (k.id !== p.id) setEntry(k.id, { ...entry(k.id), dishes: [...mine.dishes] });
                }}
              >
                Same for all the kids
              </button>
            ) : null}
          </div>
        );
      })}
      {isParent ? (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="font-bold">🍽️ For the table</p>
          <DishList
            dishes={draft.shared}
            placeholder="Mac and cheese, gyoza, edamame…"
            onChange={(shared) => setDraft((d) => ({ ...d, shared }))}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const result = await saveFavorites(restaurantId, draft);
                if ("error" in result) setError(result.error);
                else onDone(draft);
              } catch {
                setError("That didn't save. Reload and try again.");
              }
            })
          }
        >
          {pending ? "Saving…" : "Save favorites"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
