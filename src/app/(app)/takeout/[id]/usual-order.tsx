"use client";

import { useState, useTransition } from "react";
import { Avatar, Button, Card, cx, inputClass } from "@/components/ui";
import { Wheel } from "@/components/wheel";
import type { RestaurantDish, RestaurantFavorites, RestaurantFeeling, RestaurantPick, SharedItem } from "@/db/schema";
import {
  chooserOptions,
  findDish,
  EMPTY_FAVORITES,
  FEELINGS,
  orderText,
  orderTotal,
  priceOf,
  sharedItems,
  usualOrder,
  type ChooserTraits,
} from "@/lib/restaurants/favorites";
import { saveFavorites } from "../actions";

type Person = { id: string; name: string; emoji: string; color: string; role: "parent" | "kid"; traits: ChooserTraits };
/** How the family orders each dish here, keyed by the dish name in lower case. */
type Notes = Record<string, string>;

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
  const total = orderTotal(order, research?.dishes ?? []);

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
              {current ? <DishNote name={current} research={research} /> : null}
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
          <ul className="mt-2 space-y-2">
            {order.lines.map((l) => (
              <OrderLine key={l.dish} dish={l.dish} count={l.count} who={l.who.join(", ")} note={l.note} research={research} />
            ))}
            {order.shared.map((s) => (
              <OrderLine key={s.dish} dish={s.dish} count={s.count} who="to share" note={s.note} research={research} />
            ))}
          </ul>
          {total ? (
            <p className="mt-2 text-sm font-semibold">
              About ${total.toFixed(2)} {order.missing.length ? "so far" : "before tax and tip"}
            </p>
          ) : null}
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

/** One line of the order: what it is, who it's for, and what it costs. */
function OrderLine({
  dish,
  count,
  who,
  note,
  research,
}: {
  dish: string;
  count: number;
  who: string;
  note?: string | null;
  research: { dishes: RestaurantDish[]; picks: RestaurantPick[] } | null;
}) {
  const menu = research ? findDish(dish, research.dishes) : undefined;
  // Five muffins cost five dollars, so that's the figure to show. The menu
  // price goes underneath, since that's what you'll see when you order.
  const each = priceOf(menu?.price);
  const line = count > 1 && each !== null ? `$${(each * count).toFixed(2)}` : menu?.price;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span>
          <span className="font-bold">{count > 1 ? `${count}× ` : ""}</span>
          {dish} <span className="text-sm text-muted">({who})</span>
        </span>
        {line ? (
          <span className="shrink-0 text-right text-sm font-semibold">
            {line}
            {count > 1 && each !== null ? (
              <span className="block text-xs font-normal text-muted">{count} × {menu?.price}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      {note ? <p className="text-sm font-semibold text-basil">→ {note}</p> : null}
      {menu?.description ? <p className="text-xs text-muted">{menu.description}</p> : null}
    </li>
  );
}

/** What a dish actually is, from the menu lookup. */
function DishNote({ name, research }: { name: string; research: { dishes: RestaurantDish[] } | null }) {
  if (!research?.dishes.length) return null;
  const dish = findDish(name, research.dishes);
  if (!dish) {
    // Either it's not on the menu any more, or we call it something different.
    return (
      <span className="w-full text-xs text-muted">
        Not on the menu we found. Rename it to match, or refresh the menu.
      </span>
    );
  }
  if (!dish.description && !dish.price) return null;
  return (
    <span className="w-full text-xs text-muted">
      {dish.name.toLowerCase() !== name.toLowerCase() ? <span className="font-semibold">{dish.name} · </span> : null}
      {dish.price ? <span className="font-semibold">{dish.price} · </span> : null}
      {dish.description}
    </span>
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

/** "BBQ and mild", "mac and cheese + rosemary reds": the half of the order the kitchen needs. */
function NoteInput({ dish, notes, onNote }: { dish: string; notes: Notes; onNote: (dish: string, note: string) => void }) {
  return (
    <input
      className="mt-1 w-full rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs placeholder:text-muted"
      value={notes[dish.toLowerCase()] ?? ""}
      placeholder="How you order it — sauce, sides, half and half…"
      maxLength={200}
      aria-label={`How you order ${dish}`}
      onChange={(e) => onNote(dish, e.target.value)}
    />
  );
}

function DishList({
  dishes,
  onChange,
  placeholder,
  notes,
  onNote,
}: {
  dishes: string[];
  onChange: (dishes: string[]) => void;
  placeholder: string;
  notes: Notes;
  onNote: (dish: string, note: string) => void;
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
        <ul className="space-y-1.5">
          {dishes.map((d, i) => (
            <li key={d} className="rounded-2xl bg-surface-muted px-3 py-1.5 text-sm">
              <div className="flex items-center gap-1">
                {i === 0 && dishes.length > 1 ? <span title="Their usual">⭐</span> : null}
                <span className="flex-1 truncate">{d}</span>
                <button
                  type="button"
                  aria-label={`Remove ${d}`}
                  onClick={() => onChange(dishes.filter((x) => x !== d))}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
                >
                  ×
                </button>
              </div>
              <NoteInput dish={d} notes={notes} onNote={onNote} />
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

/**
 * Table items, with how many of each. "One each" is the common case — a muffin
 * per person — and it follows whoever's eating rather than freezing a number.
 */
function SharedList({
  items,
  onChange,
  notes,
  onNote,
}: {
  items: SharedItem[];
  onChange: (items: SharedItem[]) => void;
  notes: Notes;
  onNote: (dish: string, note: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const dish = draft.trim();
    if (dish && !items.some((i) => i.dish.toLowerCase() === dish.toLowerCase())) onChange([...items, { dish, qty: 1 }]);
    setDraft("");
  };
  const setQty = (dish: string, qty: SharedItem["qty"]) =>
    onChange(items.map((i) => (i.dish === dish ? { ...i, qty } : i)));

  return (
    <div className="space-y-2">
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.dish} className="rounded-2xl bg-surface-muted px-3 py-1.5 text-sm">
              <div className="flex items-center gap-2">
              <span className="flex-1 truncate">{item.dish}</span>
              <select
                className="rounded-full border border-border bg-surface px-2 py-1 text-sm font-semibold"
                aria-label={`How many ${item.dish}`}
                value={String(item.qty)}
                onChange={(e) => setQty(item.dish, e.target.value === "each" ? "each" : Number(e.target.value))}
              >
                <option value="each">1 each</option>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove ${item.dish}`}
                onClick={() => onChange(items.filter((i) => i.dish !== item.dish))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
              >
                ×
              </button>
              </div>
              <NoteInput dish={item.dish} notes={notes} onNote={onNote} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          list="menu-dishes"
          placeholder="Mac and cheese, gyoza, edamame…"
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
      <p className="text-xs text-muted">
        &ldquo;1 each&rdquo; orders one per person eating, so it shrinks when someone&apos;s away.
      </p>
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
  const notes: Notes = draft.notes ?? {};
  const setNote = (dish: string, note: string) =>
    setDraft((d) => ({ ...d, notes: { ...d.notes, [dish.toLowerCase()]: note } }));

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
              notes={notes}
              onNote={setNote}
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
          <SharedList
            items={sharedItems(draft)}
            onChange={(shared) => setDraft((d) => ({ ...d, shared }))}
            notes={notes}
            onNote={setNote}
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
