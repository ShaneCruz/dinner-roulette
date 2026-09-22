/**
 * The chaos slice on the dinner wheel. It's one dark slice, but it only
 * comes up about 1 spin in 20 so it stays a surprise.
 */
export const CHAOS_CHANCE = 1 / 20;

export type ChaosKind = "parents_choice" | "breakfast" | "spinner_side";

export const CHAOS: Record<ChaosKind, { emoji: string; label: string; line: string }> = {
  parents_choice: { emoji: "🎩", label: "Parents' Choice", line: "The grown-ups pick tonight. No complaints allowed. (Some complaints allowed.)" },
  breakfast: { emoji: "🥞", label: "Breakfast for Dinner", line: "Pancakes at 6 PM. The rules have left the building." },
  spinner_side: { emoji: "🥦", label: "You Pick the Side", line: "Top pick for dinner, and the spinner chooses the side dish." },
};

/** Where the wheel lands: the chaos slice with CHAOS_CHANCE, else any other slice evenly. */
export function pickWheelIndex(count: number, chaosIndex: number | null, random: () => number = Math.random): number {
  if (chaosIndex === null || count < 2) return Math.floor(random() * count);
  if (random() < CHAOS_CHANCE) return chaosIndex;
  const normal = Math.floor(random() * (count - 1));
  return normal >= chaosIndex ? normal + 1 : normal;
}

export function pickChaos(random: () => number = Math.random): ChaosKind {
  const kinds = Object.keys(CHAOS) as ChaosKind[];
  return kinds[Math.floor(random() * kinds.length)];
}
