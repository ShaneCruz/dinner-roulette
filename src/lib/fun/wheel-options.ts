import type { Scored } from "@/lib/suggest/engine";

/**
 * Deals the dinner wheel's slices. The best couple of fits always make it,
 * one slot goes to something the family hasn't had in a while (or ever),
 * and the rest are drawn by chance from a wider pool of good fits, so the
 * wheel isn't the same six dinners every time. Anything the planner ruled
 * out (too spicy, no time, had it recently) never shows up.
 */
export function dealWheel(
  ranked: Scored[],
  lastCooked: Map<string, string | null>,
  today: string,
  random: () => number,
  options: { size?: number; keepTop?: number; pool?: number; staleDays?: number } = {},
): string[] {
  const size = options.size ?? 6;
  const keepTop = options.keepTop ?? 2;
  const pool = ranked.filter((r) => !r.excluded).slice(0, options.pool ?? 16);
  if (pool.length <= size) return shuffle(pool.map((r) => r.recipeId), random);

  const chosen = pool.slice(0, keepTop).map((r) => r.recipeId);
  const staleBefore = shiftDate(today, -(options.staleDays ?? 45));
  const fresh = pool.filter((r) => !chosen.includes(r.recipeId) && (lastCooked.get(r.recipeId) ?? null) === null);
  const stale = pool.filter((r) => !chosen.includes(r.recipeId) && (lastCooked.get(r.recipeId) ?? "9999") < staleBefore);
  const something = fresh.length ? fresh : stale;
  if (something.length) chosen.push(something[Math.floor(random() * something.length)].recipeId);

  // Weighted draw: better fits are likelier, but anything in the pool can come up.
  const best = pool[0].score;
  const worst = pool[pool.length - 1].score;
  const spread = best - worst || 1;
  let rest = pool.filter((r) => !chosen.includes(r.recipeId));
  while (chosen.length < size && rest.length) {
    const weights = rest.map((r) => 0.3 + (r.score - worst) / spread);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = random() * total;
    let index = 0;
    while (index < rest.length - 1 && (roll -= weights[index]) > 0) index++;
    chosen.push(rest[index].recipeId);
    rest = rest.filter((_, i) => i !== index);
  }
  return shuffle(chosen, random);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
