/**
 * Finding recipes that are really the same dish. Words are weighted by how
 * common they are in the family's recipe box: with a dozen chicken dinners,
 * "chicken" says almost nothing, while "pot pie" says a lot. Two titles
 * count as similar only when they share something distinctive.
 */

const STOPWORDS = new Set([
  "with", "and", "the", "for", "our", "easy", "best", "night", "slow", "cooker", "grilled", "baked", "roasted",
  "sheet", "crispy", "homemade", "family", "quick", "simple", "style", "recipe", "classic", "grandma", "grandmas",
  "mom", "moms", "dad", "dads", "made", "pan", "one", "pot" /* "pot" alone is too weak: pot roast vs pot pie */,
  "dinner", "supper", "meal", "favorite", "world", "amazing", "perfect", "ultimate", "super", "real", "original",
]);

function words(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .split(/[^a-z]+/)
        .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

/** Short words say less; so do words half the recipe box already uses. */
function weight(word: string, inTitles: number, total: number): number {
  if (word.length <= 3) return 0.3;
  const share = total ? inTitles / total : 0;
  return inTitles >= 5 || share >= 0.25 ? 0.3 : 1;
}

export type Titled = { id: string; title: string };

/**
 * Recipes that look like the same dish as `title`, best first. `threshold`
 * is the weighted score two titles must share: one distinctive word, or a
 * shared pair of words.
 */
export function findSimilar<T extends Titled>(title: string, others: T[], threshold = 1): T[] {
  const mine = words(title);
  if (!mine.length) return [];
  const all = others.map((other) => ({ other, words: words(other.title) }));
  const inTitles = (word: string) => all.filter((o) => o.words.includes(word)).length;
  const frequency = new Map(mine.map((w) => [w, inTitles(w)]));

  const pairs = (list: string[]) => list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b].sort().join(" ")));
  const myPairs = new Set(pairs(mine));

  return all
    .map(({ other, words: theirs }) => {
      let score = mine
        .filter((w) => theirs.includes(w))
        .reduce((sum, w) => sum + weight(w, frequency.get(w) ?? 0, all.length), 0);
      // Sharing two words in the same title ("pot pie", "mac cheese") is a strong signal.
      score += pairs(theirs).filter((p) => myPairs.has(p)).length * 1.5;
      return { other, score };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.other);
}
