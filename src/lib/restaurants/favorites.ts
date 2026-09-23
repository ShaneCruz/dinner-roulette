import type { RestaurantDish, RestaurantFavorites, RestaurantFeeling, RestaurantPick, SharedItem } from "@/db/schema";

/**
 * The family's usual takeout order. Pure helpers so the page, the wheel and
 * tests all agree on how an order adds up.
 */

export const FEELINGS: Record<RestaurantFeeling, { emoji: string; label: string }> = {
  love: { emoji: "😍", label: "Loves it" },
  fine: { emoji: "🙂", label: "It's fine" },
  meh: { emoji: "😕", label: "Not a fan" },
};

export const EMPTY_FAVORITES: RestaurantFavorites = { people: {}, shared: [] };

/** Table items, however they were saved: a bare name counts as one. */
export function sharedItems(favorites: RestaurantFavorites | null): SharedItem[] {
  return (favorites?.shared ?? []).map((item) =>
    typeof item === "string" ? { dish: item, qty: 1 } : { dish: item.dish, qty: item.qty },
  );
}

export function cleanFavorites(input: RestaurantFavorites): RestaurantFavorites {
  const clean = (dishes: string[]) => {
    const seen = new Set<string>();
    return dishes
      .map((d) => d.trim().replace(/\s+/g, " ").slice(0, 80))
      .filter((d) => d && !seen.has(d.toLowerCase()) && seen.add(d.toLowerCase()))
      .slice(0, 12);
  };
  const people: RestaurantFavorites["people"] = {};
  for (const [id, entry] of Object.entries(input.people)) {
    const dishes = clean(entry.dishes);
    if (dishes.length || entry.feeling) people[id] = { dishes, feeling: entry.feeling ?? null };
  }
  const items = sharedItems(input);
  const names = clean(items.map((i) => i.dish));
  const shared = names.map((dish) => {
    const found = items.find((i) => i.dish.trim().toLowerCase() === dish.toLowerCase());
    const qty = found?.qty === "each" ? ("each" as const) : Math.min(Math.max(Math.round(Number(found?.qty) || 1), 1), 20);
    return { dish, qty };
  });
  return { people, shared: shared.slice(0, 20) };
}

export type OrderLine = { dish: string; count: number; who: string[] };

/**
 * Adds up the usual order for the people eating: each person's first
 * favorite, plus the shared items. Same dish, one line: "3× Kids Drumsticks".
 */
export function usualOrder(
  favorites: RestaurantFavorites | null,
  people: { id: string; name: string }[],
  choices: Record<string, string> = {},
): { lines: OrderLine[]; shared: { dish: string; count: number }[]; missing: string[] } {
  const lines: OrderLine[] = [];
  const missing: string[] = [];
  for (const person of people) {
    const dish = choices[person.id] ?? favorites?.people[person.id]?.dishes[0];
    if (!dish) {
      missing.push(person.name);
      continue;
    }
    const line = lines.find((l) => l.dish.toLowerCase() === dish.toLowerCase());
    if (line) {
      line.count++;
      line.who.push(person.name);
    } else lines.push({ dish, count: 1, who: [person.name] });
  }
  // "One each" follows whoever's eating tonight, so a night without the kids
  // doesn't order five muffins.
  const shared = sharedItems(favorites).map((item) => ({
    dish: item.dish,
    count: item.qty === "each" ? people.length : item.qty,
  }));
  return { lines, shared: shared.filter((s) => s.count > 0), missing };
}

export function orderText(order: ReturnType<typeof usualOrder>, restaurantName: string): string {
  const rows = [
    ...order.lines.map((l) => `${l.count > 1 ? `${l.count}× ` : ""}${l.dish} (${l.who.join(", ")})`),
    ...order.shared.map((s) => `${s.count > 1 ? `${s.count}× ` : ""}${s.dish} (to share)`),
  ];
  return `${restaurantName} order:\n${rows.map((r) => `• ${r}`).join("\n")}`;
}

export type ChooserTraits = { isKid: boolean; spiceTolerance: number; prefersHighProtein: boolean; wantsHealthy: boolean };

/**
 * Options for "help me choose": their favorites first, then the dish the
 * menu research picked for them, then a few menu dishes that suit them.
 */
export function chooserOptions(
  memberId: string,
  favorites: RestaurantFavorites | null,
  research: { dishes: RestaurantDish[]; picks: RestaurantPick[] } | null,
  traits: ChooserTraits,
  max = 8,
): string[] {
  const out: string[] = [];
  const add = (dish: string | undefined) => {
    if (dish && out.length < max && !out.some((d) => d.toLowerCase() === dish.toLowerCase())) out.push(dish);
  };
  // Leave a couple of slots for menu ideas even when the favorites list is long.
  for (const dish of (favorites?.people[memberId]?.dishes ?? []).slice(0, max - 2)) add(dish);
  add(research?.picks.find((p) => p.memberId === memberId)?.dish);
  const suitable = (research?.dishes ?? [])
    .filter((d) => !(traits.spiceTolerance <= 1 && d.tags.includes("spicy")))
    .map((d) => {
      let score = 0;
      if (traits.isKid && (d.tags.includes("kid_friendly") || d.tags.includes("mild"))) score += 2;
      if (traits.prefersHighProtein && d.tags.includes("high_protein")) score += 2;
      if (traits.wantsHealthy && d.tags.includes("lighter")) score += 1;
      if (d.tags.includes("shareable")) score -= 1;
      return { name: d.name, score };
    })
    .sort((a, b) => b.score - a.score);
  for (const d of suitable) add(d.name);
  return out;
}

/**
 * How likely the takeout wheel lands on a place: places the people eating
 * love come up more, places someone isn't a fan of come up less.
 */
export function restaurantWeight(favorites: RestaurantFavorites | null, eaterIds: string[]): number {
  let weight = 1;
  for (const id of eaterIds) {
    const feeling = favorites?.people[id]?.feeling;
    if (feeling === "love") weight += 0.5;
    if (feeling === "meh") weight -= 0.35;
  }
  return Math.max(0.25, weight);
}

/** Picks an index with the given weights. */
export function weightedIndex(weights: number[], random: () => number = Math.random): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Matching what you call a dish ("Chips and Guac") to what the menu calls it
 * ("Fresh Chips with Mild Salsa & Guacamole"). Menus rename things constantly,
 * so this compares the meaningful words rather than the whole name.
 */
const DISH_NOISE = new Set([
  "the", "a", "and", "with", "of", "our", "fresh", "house", "homemade", "classic", "original", "signature",
  "served", "side", "regular", "combo", "plate", "platter", "meal", "style", "mild", "new",
  // Compared separately as qualifiers below, so they don't skew the words.
  "kid", "kids", "junior", "little", "large", "jumbo", "family", "double", "small", "half", "mini", "cup",
  "veggie", "vegan", "vegetarian", "gluten", "spicy", "hot", "buffalo", "nashville",
]);

function dishWords(name: string): string[] {
  return [
    ...new Set(
      name
        .toLowerCase()
        .replace(/\(.*?\)/g, " ")
        .split(/[^a-z0-9]+/)
        .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
        .filter((w) => w.length >= 2 && !DISH_NOISE.has(w)),
    ),
  ];
}

/**
 * Words that make a dish a different dish, not a fancier name for the same
 * one: a kid's mac and cheese isn't the mac and cheese, and a large isn't a
 * small. Both names have to agree on these.
 */
const QUALIFIERS: [string, RegExp][] = [
  ["kids", /\bkid('?s)?\b|\bjunior\b|\blittle\b/],
  ["size", /\blarge\b|\bjumbo\b|\bfamily\b|\bdouble\b/],
  ["small", /\bsmall\b|\bhalf\b|\bmini\b|\bcup\b/],
  ["veg", /\bveggie\b|\bvegan\b|\bvegetarian\b/],
  ["gf", /\bgluten\b|\bcauliflower crust\b/],
  ["hot", /\bspicy\b|\bhot\b|\bbuffalo\b|\bnashville\b/],
];

function qualifiers(name: string): string[] {
  const text = name.toLowerCase();
  return QUALIFIERS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

/** "guac" and "guacamole", "drumstick" and "drumsticks": the same word. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/** Do these two names look like the same dish? */
export function sameDish(a: string, b: string): boolean {
  const ours = qualifiers(a);
  const theirs = qualifiers(b);
  if (ours.length !== theirs.length || ours.some((q) => !theirs.includes(q))) return false;
  const left = dishWords(a);
  const right = dishWords(b);
  if (!left.length || !right.length) return false;
  const shared = left.filter((w) => right.some((r) => sameWord(w, r)));
  if (!shared.length) return false;
  // Every word of the shorter name shows up in the longer one ("chips guac"
  // inside "fresh chips mild salsa guacamole"), or nearly all words match both
  // ways. The bar is high because one word apart is usually a different dish:
  // a red dragon roll is not the yellow one.
  const shorter = Math.min(left.length, right.length);
  return shared.length === shorter || shared.length / Math.max(left.length, right.length) >= 0.75;
}

/** The menu entry for a dish the family named, if there is one. */
export function findDish<T extends { name: string }>(name: string, dishes: T[]): T | undefined {
  return dishes.find((d) => d.name.toLowerCase() === name.toLowerCase()) ?? dishes.find((d) => sameDish(d.name, name));
}

/** "$8.99" → 8.99; "$14-22" → 14; anything else → null. */
export function priceOf(text: string | null | undefined): number | null {
  const match = text?.match(/\d+(?:\.\d{2})?/);
  const value = match ? Number(match[0]) : NaN;
  return Number.isFinite(value) ? value : null;
}

/** Roughly what the order comes to, when the menu gives prices. */
export function orderTotal(
  order: { lines: OrderLine[]; shared: { dish: string; count: number }[] },
  dishes: { name: string; price: string | null }[],
): number | null {
  if (!dishes.length) return null;
  let total = 0;
  let priced = 0;
  for (const line of order.lines) {
    const price = priceOf(findDish(line.dish, dishes)?.price);
    if (price === null) continue;
    total += price * line.count;
    priced++;
  }
  for (const item of order.shared) {
    const price = priceOf(findDish(item.dish, dishes)?.price);
    if (price === null) continue;
    total += price * item.count;
    priced++;
  }
  return priced ? total : null;
}
