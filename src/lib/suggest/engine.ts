/**
 * The dinner suggestion engine. Pure functions, no database: give it the
 * family, the recipes, their history and the nights to fill, and it returns
 * scored, explained suggestions.
 *
 * 1. Hard filters remove dinners that can't work tonight (a hard nope with
 *    no swap, too spicy with no mild version, not enough time, eaten too
 *    recently, grill nights used up).
 * 2. A score ranks the rest: how much the people eating like it (whoever's
 *    turn it is counts triple), freshness, the healthy/comfort balance,
 *    season and weather, and ingredients shared with the rest of the week.
 * 3. The week is filled night by night, so later picks see earlier ones.
 */
import { daysBetween } from "@/lib/presence";
import { ingredientMatches } from "@/lib/recipes/audience";
import { fitsBudget, type TimeBudget } from "@/lib/plan/week";
import type { Nutrition } from "@/db/schema";

export type EngineRecipe = {
  id: string;
  slug: string;
  title: string;
  kind: "main" | "side";
  cuisine: string;
  tags: string[];
  method: string;
  activeMinutes: number;
  totalMinutes: number;
  spiceLevel: number;
  spiceSplit: string | null;
  seasonFit: "any" | "warm" | "cold";
  indoorMethod: string | null;
  healthCategory: "healthy" | "balanced" | "comfort";
  cooldownDays: number | null;
  pairsWith: string[];
  ingredients: { name: string; perishable: boolean; optional?: boolean; section?: string }[];
  variants: { kind: string; label: string; avoids: string[] }[];
  /** Most recent cooked date before the week being planned */
  lastCooked: string | null;
  /** Per-serving estimate, when known (display only) */
  nutrition?: Nutrition | null;
};

export type EngineMember = {
  id: string;
  name: string;
  role: "parent" | "kid";
  spiceTolerance: number;
  nopes: string[];
  lovedRecipeIds: string[];
  /** Average stars (1-5) this person gave each recipe */
  ratings: Record<string, number>;
  /** Usually away (boarding school); gets First Pick on their first night home */
  usuallyAway?: boolean;
  /** This week's swipe-round votes: -1 nope, 1 yes, 2 love, 4 doubled love */
  votes?: Record<string, number>;
};

export type Weather = { tempMaxF: number; precipChance: number };

export type EngineNight = {
  date: string;
  eaterIds: string[];
  budget: TimeBudget;
  weather?: Weather | null;
  /** Already decided whose turn it is */
  favoredMemberId?: string | null;
};

export type EngineSettings = {
  defaultCooldownDays: number;
  weeknightActiveMinutes: number;
  healthyNightsTarget: number;
  grillCaps: { summer: number; shoulder: number; winter: number };
};

export type EngineContext = {
  members: EngineMember[];
  recipes: EngineRecipe[];
  settings: EngineSettings;
  /** Veto cards played this week: these dinners are off the table */
  vetoes?: { recipeId: string; memberId: string }[];
};

/** How much a swipe-round vote moves someone's like for a dinner. */
export function voteBoost(vote: number | undefined): number {
  if (vote === undefined) return 0;
  if (vote < 0) return -1.5;
  if (vote >= 4) return 2.5;
  if (vote >= 2) return 1.5;
  return 0.7;
}

/** Dinners already on the plan this week (fixed or chosen earlier in the fill). */
export type Chosen = { date: string; recipeId: string };

export type Scored = {
  recipeId: string;
  score: number;
  /** Friendly one-liners, best first */
  reasons: string[];
  /** Why it can't work tonight, or null if it can */
  excluded: string | null;
};

// Things nearly every dinner uses; sharing them doesn't simplify shopping.
const STAPLE_ENDINGS = ["salt", "black pepper", "oil", "butter", "garlic", "sugar", "flour", "water"];

function isStapleIngredient(name: string) {
  return STAPLE_ENDINGS.some((w) => name === w || name.endsWith(` ${w}`));
}

export function season(date: string): "summer" | "shoulder" | "winter" {
  const month = Number(date.slice(5, 7));
  if (month === 12 || month <= 2) return "winter";
  if (month >= 5 && month <= 9) return "summer";
  return "shoulder";
}

export function isBadGrillWeather(weather: Weather | null | undefined): boolean {
  return Boolean(weather && (weather.tempMaxF < 35 || weather.precipChance >= 60));
}

function isGrilled(recipe: EngineRecipe) {
  return recipe.method === "grill" || recipe.tags.includes("grilled");
}

function meaningfulIngredients(recipe: EngineRecipe): string[] {
  return recipe.ingredients
    .filter((i) => i.perishable && !i.optional && !isStapleIngredient(i.name))
    .map((i) => i.name);
}

/** How much one person should like a recipe, from -2 (hate) to +2 (love). */
export function likeFor(member: EngineMember, recipe: EngineRecipe, recipesById: Map<string, EngineRecipe>): {
  value: number;
  source: "rating" | "love" | "similar" | "unknown";
} {
  const rated = member.ratings[recipe.id];
  if (rated !== undefined) return { value: rated - 3, source: "rating" };
  if (member.lovedRecipeIds.includes(recipe.id)) return { value: 1.5, source: "love" };

  // Guess from how they rated dinners with the same cuisine or tags.
  const traits = new Set([recipe.cuisine.toLowerCase(), ...recipe.tags]);
  const similar: number[] = [];
  for (const [id, stars] of Object.entries(member.ratings)) {
    const other = recipesById.get(id);
    if (!other) continue;
    const shared = [other.cuisine.toLowerCase(), ...other.tags].filter((t) => traits.has(t)).length;
    if (shared > 0) similar.push(stars - 3);
  }
  if (similar.length) {
    return { value: (similar.reduce((a, b) => a + b, 0) / similar.length) * 0.5, source: "similar" };
  }
  return { value: 0, source: "unknown" };
}

export function scoreRecipe(
  recipe: EngineRecipe,
  night: EngineNight,
  context: EngineContext,
  chosen: Chosen[],
  recipesById: Map<string, EngineRecipe> = new Map(context.recipes.map((r) => [r.id, r])),
): Scored {
  const eaters = context.members.filter((m) => night.eaterIds.includes(m.id));
  const exclude = (why: string): Scored => ({ recipeId: recipe.id, score: -Infinity, reasons: [], excluded: why });
  const reasons: { text: string; weight: number }[] = [];
  let score = 0;

  // --- Hard filters -------------------------------------------------------
  if (recipe.kind !== "main") return exclude("It's a side dish");

  const others = chosen.filter((c) => c.date !== night.date);
  if (others.some((c) => c.recipeId === recipe.id)) return exclude("Already on the plan this week");

  const veto = context.vetoes?.find((v) => v.recipeId === recipe.id);
  if (veto) {
    const who = context.members.find((m) => m.id === veto.memberId)?.name ?? "Someone";
    return exclude(`Vetoed by ${who} this week`);
  }

  if (!fitsBudget(recipe, night.budget, context.settings.weeknightActiveMinutes)) {
    return exclude("Needs more time than tonight has");
  }

  for (const eater of eaters) {
    for (const nope of eater.nopes) {
      const hit = recipe.ingredients.find((i) => !i.optional && ingredientMatches(i.name, nope));
      if (!hit) continue;
      const swap = recipe.variants.find((v) => v.avoids.some((a) => ingredientMatches(a, nope)));
      if (!swap) return exclude(`${eater.name} doesn't eat ${nope}`);
      reasons.push({ text: `${swap.label} for ${eater.name}`, weight: 0.05 });
    }
  }

  if (eaters.length) {
    const mildest = eaters.reduce((a, b) => (b.spiceTolerance < a.spiceTolerance ? b : a));
    const canBeMild = Boolean(recipe.spiceSplit) || recipe.variants.some((v) => v.kind === "mild");
    if (recipe.spiceLevel > mildest.spiceTolerance && !canBeMild) {
      return exclude(`Too spicy for ${mildest.name}`);
    }
  }

  const familyStars = eaters.map((e) => e.ratings[recipe.id]).filter((s): s is number => s !== undefined);
  const familyAverage = familyStars.length ? familyStars.reduce((a, b) => a + b, 0) / familyStars.length : null;
  if (recipe.lastCooked) {
    let cooldown = recipe.cooldownDays ?? context.settings.defaultCooldownDays;
    // Big hits can come back sooner.
    if (familyAverage !== null && familyAverage >= 4.5) cooldown = Math.min(cooldown, 7);
    const since = daysBetween(recipe.lastCooked, night.date);
    if (since < cooldown) return exclude(`Had it ${since === 1 ? "yesterday" : `${since} days ago`}`);
  }

  const seasonNow = season(night.date);
  const grillsThisWeek = others.filter((c) => {
    const r = recipesById.get(c.recipeId);
    return r && isGrilled(r);
  }).length;
  const badWeather = isBadGrillWeather(night.weather);
  if (isGrilled(recipe)) {
    const capReached = grillsThisWeek >= context.settings.grillCaps[seasonNow];
    if ((capReached || badWeather) && !recipe.indoorMethod) {
      return exclude(capReached ? "Grill nights are used up this week" : "Bad grilling weather");
    }
    if (badWeather) {
      score -= 0.4;
      reasons.push({ text: "Cook it indoors tonight (weather)", weight: 0.1 });
    } else if (capReached) {
      score -= 0.4;
      reasons.push({ text: "Cook it indoors (grill nights used up)", weight: 0.1 });
    }
  }

  // --- Taste --------------------------------------------------------------
  if (eaters.length) {
    let total = 0;
    let weights = 0;
    for (const eater of eaters) {
      const favored = eater.id === night.favoredMemberId;
      const weight = favored ? 3 : 1;
      const like = likeFor(eater, recipe, recipesById);
      const vote = eater.votes?.[recipe.id];
      const value = Math.max(-2.5, Math.min(3, like.value + voteBoost(vote)));
      total += value * weight;
      weights += weight;
      if (vote !== undefined && vote >= 4) reasons.push({ text: `${eater.name} doubled down on it`, weight: 3.5 });
      else if (vote === 2) reasons.push({ text: `${eater.name} loved it in the swipe round`, weight: favored ? 3.2 : 2.6 });
      else if (favored && like.value >= 1) reasons.push({ text: `${eater.name}'s pick: loves it`, weight: 3 });
      else if (favored && value > 0.2) reasons.push({ text: `${eater.name} likes this kind of dinner`, weight: 2 });
      if (like.value <= -1.5) reasons.push({ text: `${eater.name} wasn't a fan last time`, weight: -1 });
    }
    score += (total / weights) * 2;
    if (familyAverage !== null && familyAverage >= 4) {
      reasons.push({ text: "Everyone liked it last time", weight: 2.5 });
    }
  }

  // --- Freshness ----------------------------------------------------------
  if (!recipe.lastCooked) {
    score += 0.2;
  } else {
    const since = daysBetween(recipe.lastCooked, night.date);
    score += (Math.min(since, 60) / 60) * 0.6;
    if (since >= 30) reasons.push({ text: `Haven't had it in ${Math.round(since / 7)} weeks`, weight: 1 });
  }

  // --- Healthy / comfort balance -------------------------------------------
  const chosenRecipes = others.map((c) => recipesById.get(c.recipeId)).filter((r): r is EngineRecipe => Boolean(r));
  const healthyShare = chosenRecipes.length
    ? chosenRecipes.filter((r) => r.healthCategory === "healthy").length / chosenRecipes.length
    : 0;
  const target = context.settings.healthyNightsTarget / 7;
  if (healthyShare < target) {
    if (recipe.healthCategory === "healthy") {
      score += 0.6;
      reasons.push({ text: "Healthy night", weight: 1.2 });
    } else if (recipe.healthCategory === "comfort") {
      score -= 0.4;
    }
  } else if (recipe.healthCategory === "comfort") {
    score += 0.3;
    reasons.push({ text: "Comfort food night", weight: 0.8 });
  }

  // --- Season -------------------------------------------------------------
  if (recipe.seasonFit === "cold") {
    if (seasonNow === "summer") score -= 0.6;
    else {
      score += 0.4;
      reasons.push({ text: "Cozy for cold weather", weight: 0.9 });
    }
  } else if (recipe.seasonFit === "warm") {
    if (seasonNow === "winter") score -= 0.6;
    else if (seasonNow === "summer") score += 0.3;
  }

  // --- Shared ingredients -------------------------------------------------
  const mine = meaningfulIngredients(recipe);
  const shared: { name: string; date: string }[] = [];
  for (const c of others) {
    const other = recipesById.get(c.recipeId);
    if (!other) continue;
    const theirs = meaningfulIngredients(other);
    for (const name of mine) {
      if (theirs.includes(name) && !shared.some((s) => s.name === name)) shared.push({ name, date: c.date });
    }
  }
  if (shared.length) {
    score += Math.min(shared.length * 0.25, 1);
    reasons.push({
      text: `Shares ${shared.slice(0, 2).map((s) => s.name).join(" and ")} with this week`,
      weight: 1.1,
    });
  }

  // --- Variety ------------------------------------------------------------
  // Sharing onions across the week is handy; eating the same thing two
  // nights running is not.
  const neighbors = others
    .filter((c) => Math.abs(daysBetween(c.date, night.date)) === 1)
    .map((c) => recipesById.get(c.recipeId))
    .filter((r): r is EngineRecipe => Boolean(r));
  const proteins = (r: EngineRecipe) => r.ingredients.filter((i) => i.section === "meat" || i.section === "seafood").map((i) => i.name);
  const myProteins = proteins(recipe);
  for (const neighbor of neighbors) {
    if (neighbor.cuisine === recipe.cuisine) score -= 0.8;
    if (recipe.tags.includes("pasta") && neighbor.tags.includes("pasta")) score -= 0.6;
    if (recipe.tags.includes("soup") && neighbor.tags.includes("soup")) score -= 0.6;
    if (proteins(neighbor).some((p) => myProteins.includes(p))) score -= 0.8;
  }

  return {
    recipeId: recipe.id,
    score,
    reasons: reasons.sort((a, b) => b.weight - a.weight).map((r) => r.text),
    excluded: null,
  };
}

export function rankForNight(night: EngineNight, context: EngineContext, chosen: Chosen[]): Scored[] {
  const byId = new Map(context.recipes.map((r) => [r.id, r]));
  return context.recipes
    .filter((r) => r.kind === "main")
    .map((r) => scoreRecipe(r, night, context, chosen, byId))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Whose turn is it?
// ---------------------------------------------------------------------------

export type TurnHistory = { date: string; memberId: string }[];

/**
 * Picks whose tastes count double each night. The kid who has been favored
 * least recently goes next; a usually-away kid's first night home is theirs
 * ("First Pick"). Parents take turns only when no kids are eating.
 */
export function assignTurns(
  nights: EngineNight[],
  members: EngineMember[],
  history: TurnHistory,
  firstNightHome: Record<string, string> = {},
): Map<string, { memberId: string; firstPick: boolean }> {
  const result = new Map<string, { memberId: string; firstPick: boolean }>();
  const counts = new Map<string, number>();
  const last = new Map<string, string>();
  for (const h of history) {
    counts.set(h.memberId, (counts.get(h.memberId) ?? 0) + 1);
    if (!last.has(h.memberId) || h.date > last.get(h.memberId)!) last.set(h.memberId, h.date);
  }

  for (const night of [...nights].sort((a, b) => a.date.localeCompare(b.date))) {
    if (night.favoredMemberId) {
      result.set(night.date, { memberId: night.favoredMemberId, firstPick: false });
      continue;
    }
    const firstPicker = Object.entries(firstNightHome).find(
      ([memberId, date]) => date === night.date && night.eaterIds.includes(memberId),
    );
    let chosen: string | undefined = firstPicker?.[0];
    if (!chosen) {
      const eating = members.filter((m) => night.eaterIds.includes(m.id));
      const pool = eating.some((m) => m.role === "kid") ? eating.filter((m) => m.role === "kid") : eating;
      if (!pool.length) continue;
      chosen = [...pool].sort(
        (a, b) =>
          (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
          (last.get(a.id) ?? "").localeCompare(last.get(b.id) ?? "") ||
          a.name.localeCompare(b.name),
      )[0].id;
    }
    result.set(night.date, { memberId: chosen, firstPick: Boolean(firstPicker) });
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
    last.set(chosen, night.date);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Filling a week
// ---------------------------------------------------------------------------

export type Suggestion = {
  date: string;
  recipeId: string;
  sideRecipeIds: string[];
  favoredMemberId: string | null;
  firstPick: boolean;
  reason: string;
};

/** Small, seedable random source so "suggest again" varies but tests don't. */
export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pickFromTop(ranked: Scored[], random: () => number): Scored | null {
  const usable = ranked.filter((r) => !r.excluded);
  if (!usable.length) return null;
  const best = usable[0].score;
  const close = usable.slice(0, 4).filter((r) => r.score >= best - 0.6);
  const weights = [0.55, 0.25, 0.13, 0.07].slice(0, close.length);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = random() * total;
  for (let i = 0; i < close.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return close[i];
  }
  return close[0];
}

export function suggestWeek(
  nights: EngineNight[],
  context: EngineContext,
  fixed: Chosen[],
  options: { random?: () => number; history?: TurnHistory; firstNightHome?: Record<string, string>; avoid?: Record<string, string> } = {},
): Suggestion[] {
  const random = options.random ?? Math.random;
  const turns = assignTurns(nights, context.members, options.history ?? [], options.firstNightHome);
  const chosen: Chosen[] = [...fixed];
  const byId = new Map(context.recipes.map((r) => [r.id, r]));
  const out: Suggestion[] = [];
  const names = new Map(context.members.map((m) => [m.id, m.name]));

  for (const night of [...nights].sort((a, b) => a.date.localeCompare(b.date))) {
    const turn = turns.get(night.date);
    const withTurn = { ...night, favoredMemberId: turn?.memberId ?? null };
    let ranked = rankForNight(withTurn, context, chosen);
    const avoid = options.avoid?.[night.date];
    if (avoid) ranked = ranked.filter((r) => r.recipeId !== avoid);
    const pick = pickFromTop(ranked, random);
    if (!pick) continue;
    const recipe = byId.get(pick.recipeId)!;
    const sideOptions = recipe.pairsWith
      .map((slug) => context.recipes.find((r) => r.kind === "side" && r.slug === slug))
      .filter((r): r is EngineRecipe => Boolean(r));
    const side = sideOptions.length ? sideOptions[Math.floor(random() * sideOptions.length)] : null;
    chosen.push({ date: night.date, recipeId: pick.recipeId });
    const who = turn ? names.get(turn.memberId) : null;
    const reason = turn?.firstPick
      ? `Welcome home, ${who}! First pick.`
      : pick.reasons[0] ?? (who ? `${who}'s turn` : "A solid pick");
    out.push({
      date: night.date,
      recipeId: pick.recipeId,
      sideRecipeIds: side ? [side.id] : [],
      favoredMemberId: turn?.memberId ?? null,
      firstPick: Boolean(turn?.firstPick),
      reason,
    });
  }
  return out;
}
