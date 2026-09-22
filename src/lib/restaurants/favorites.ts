import type { RestaurantDish, RestaurantFavorites, RestaurantFeeling, RestaurantPick } from "@/db/schema";

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
  return { people, shared: clean(input.shared).slice(0, 20) };
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
): { lines: OrderLine[]; shared: string[]; missing: string[] } {
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
  return { lines, shared: favorites?.shared ?? [], missing };
}

export function orderText(order: ReturnType<typeof usualOrder>, restaurantName: string): string {
  const rows = [
    ...order.lines.map((l) => `${l.count > 1 ? `${l.count}× ` : ""}${l.dish} (${l.who.join(", ")})`),
    ...order.shared.map((s) => `${s} (to share)`),
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
