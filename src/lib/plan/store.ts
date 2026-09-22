import { and, asc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
import type { Database } from "@/db";
import {
  bumpedMeal,
  groceryItem,
  member,
  memberAvailability,
  memberFoodRule,
  plannedMeal,
  recipe,
  weekPlan,
} from "@/db/schema";
import { buildGroceryList, type GroceryMealInput } from "@/lib/grocery/build";
import { presenceOn, type PresenceRange } from "@/lib/presence";
import { variantAudience, type AudienceMember } from "@/lib/recipes/audience";
import { getRecipe, type StoredRecipe } from "@/lib/recipes/store";
import { weekDates, weekStartFor, type NightType, type TimeBudget } from "./week";

export type PlannedMealRow = typeof plannedMeal.$inferSelect;

export async function getOrCreateWeekPlan(db: Database, weekStart: string) {
  const [existing] = await db.select().from(weekPlan).where(eq(weekPlan.weekStart, weekStart)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(weekPlan)
    .values({ weekStart })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db.select().from(weekPlan).where(eq(weekPlan.weekStart, weekStart)).limit(1);
  return raced;
}

export async function findWeekPlan(db: Database, weekStart: string) {
  const [found] = await db.select().from(weekPlan).where(eq(weekPlan.weekStart, weekStart)).limit(1);
  return found ?? null;
}

/** Planned meals between two dates (inclusive), keyed by date. */
export async function loadMeals(db: Database, from: string, to: string) {
  const rows = await db
    .select()
    .from(plannedMeal)
    .where(and(gte(plannedMeal.date, from), lte(plannedMeal.date, to)))
    .orderBy(asc(plannedMeal.date));
  return new Map(rows.map((row) => [row.date, row]));
}

export type NightPatch = Partial<{
  nightType: NightType;
  recipeId: string | null;
  sideRecipeIds: string[];
  eaterIds: string[] | null;
  servings: number | null;
  timeBudget: TimeBudget;
  status: "planned" | "cooked" | "skipped";
  notes: string | null;
  favoredMemberId: string | null;
  suggestionReason: string | null;
  restaurantId: string | null;
}>;

/** Creates or updates the dinner on `date`. Returns the week plan id. */
export async function saveNight(
  db: Database,
  date: string,
  weekStartsOn: number,
  patch: NightPatch,
): Promise<string> {
  const plan = await getOrCreateWeekPlan(db, weekStartFor(date, weekStartsOn));
  const values = {
    ...patch,
    ...(patch.status === "cooked" ? { cookedAt: new Date() } : {}),
    ...(patch.status === "planned" ? { cookedAt: null } : {}),
  };
  const insert = db.insert(plannedMeal).values({ weekPlanId: plan.id, date, ...values });
  if (Object.keys(values).length === 0) await insert.onConflictDoNothing();
  else await insert.onConflictDoUpdate({ target: plannedMeal.date, set: values });
  return plan.id;
}

export async function clearNight(db: Database, date: string) {
  await db.delete(plannedMeal).where(eq(plannedMeal.date, date));
}

/**
 * Swaps what's planned on two nights. Who's eating and the time budget stay
 * with the night, since those describe the day, not the dinner.
 */
export async function swapNights(db: Database, a: string, b: string, weekStartsOn: number) {
  const meals = await loadMeals(db, a < b ? a : b, a < b ? b : a);
  const first = meals.get(a);
  const second = meals.get(b);
  const dinnerOf = (m: PlannedMealRow | undefined): NightPatch => ({
    nightType: m?.nightType ?? "cook",
    recipeId: m?.recipeId ?? null,
    sideRecipeIds: m?.sideRecipeIds ?? [],
    servings: m?.servings ?? null,
    notes: m?.notes ?? null,
    status: "planned",
  });
  await saveNight(db, a, weekStartsOn, dinnerOf(second));
  await saveNight(db, b, weekStartsOn, dinnerOf(first));
}

/** Skips a night; its dinner waits in the bumped tray if it had one. */
export async function skipNight(db: Database, date: string, weekStartsOn: number, keepForLater: boolean) {
  const [meal] = await db.select().from(plannedMeal).where(eq(plannedMeal.date, date)).limit(1);
  if (meal?.recipeId && keepForLater) {
    await db.insert(bumpedMeal).values({
      recipeId: meal.recipeId,
      sideRecipeIds: meal.sideRecipeIds,
      fromDate: date,
    });
  }
  await saveNight(db, date, weekStartsOn, { status: "skipped" });
}

export async function listBumped(db: Database) {
  return db
    .select({
      id: bumpedMeal.id,
      fromDate: bumpedMeal.fromDate,
      recipeId: bumpedMeal.recipeId,
      sideRecipeIds: bumpedMeal.sideRecipeIds,
      title: recipe.title,
      slug: recipe.slug,
    })
    .from(bumpedMeal)
    .innerJoin(recipe, eq(recipe.id, bumpedMeal.recipeId))
    .orderBy(asc(bumpedMeal.fromDate));
}

export async function placeBumped(db: Database, bumpedId: string, date: string, weekStartsOn: number) {
  const [bumped] = await db.select().from(bumpedMeal).where(eq(bumpedMeal.id, bumpedId)).limit(1);
  if (!bumped) return null;
  const planId = await saveNight(db, date, weekStartsOn, {
    nightType: "cook",
    recipeId: bumped.recipeId,
    sideRecipeIds: bumped.sideRecipeIds,
    status: "planned",
  });
  await db.delete(bumpedMeal).where(eq(bumpedMeal.id, bumpedId));
  return planId;
}

export async function discardBumped(db: Database, bumpedId: string) {
  await db.delete(bumpedMeal).where(eq(bumpedMeal.id, bumpedId));
}

// ---------------------------------------------------------------------------
// Who's eating
// ---------------------------------------------------------------------------

export type EaterContext = {
  members: (AudienceMember & { defaultPresence: "home" | "away" })[];
  ranges: PresenceRange[];
};

export async function loadEaterContext(db: Database, from: string, to: string): Promise<EaterContext> {
  const [members, ranges, nopes] = await Promise.all([
    db.select().from(member),
    db
      .select()
      .from(memberAvailability)
      .where(and(lte(memberAvailability.startDate, to), gte(memberAvailability.endDate, from))),
    db.select().from(memberFoodRule).where(eq(memberFoodRule.kind, "nope")),
  ]);
  return {
    members: members
      .filter((m) => !m.archivedAt)
      .map((m) => ({
        id: m.id,
        name: m.name,
        spiceTolerance: m.spiceTolerance,
        prefersHighProtein: m.prefersHighProtein,
        wantsHealthySwaps: m.wantsHealthySwaps,
        defaultPresence: m.defaultPresence,
        nopes: nopes.filter((n) => n.memberId === m.id && n.ingredient).map((n) => n.ingredient!),
      })),
    ranges: ranges.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      startDate: r.startDate,
      endDate: r.endDate,
      presence: r.presence,
      label: r.label,
      tentative: r.tentative,
    })),
  };
}

/** The people eating on a night: an explicit list, or whoever is home. */
export function eatersFor(
  context: EaterContext,
  date: string,
  eaterIds: string[] | null | undefined,
): EaterContext["members"] {
  if (eaterIds) return context.members.filter((m) => eaterIds.includes(m.id));
  return context.members.filter((m) => presenceOn(m, context.ranges, date).presence === "home");
}

export function servingsFor(meal: { servings: number | null }, eaterCount: number): number {
  return meal.servings ?? Math.max(eaterCount, 1);
}

// ---------------------------------------------------------------------------
// Groceries
// ---------------------------------------------------------------------------

/**
 * Rebuilds the week's generated grocery items from its planned meals.
 * Checked items that are no longer needed are kept (marked stale) so nobody
 * loses track of what's already in the cart; manual items are untouched.
 */
export async function regenerateGroceryList(db: Database, weekPlanId: string) {
  const [plan] = await db.select().from(weekPlan).where(eq(weekPlan.id, weekPlanId)).limit(1);
  if (!plan) return;
  const dates = weekDates(plan.weekStart);
  const meals = [...(await loadMeals(db, dates[0], dates[6])).values()].filter(
    (m) => m.nightType === "cook" && m.status !== "skipped" && m.recipeId,
  );
  const context = await loadEaterContext(db, dates[0], dates[6]);

  const recipeIds = [...new Set(meals.flatMap((m) => [m.recipeId!, ...m.sideRecipeIds]))];
  const recipes = new Map<string, StoredRecipe>();
  for (const id of recipeIds) {
    const found = await getRecipe(db, { id });
    if (found) recipes.set(id, found);
  }

  const inputs: GroceryMealInput[] = [];
  for (const meal of meals) {
    const eaters = eatersFor(context, meal.date, meal.eaterIds);
    const servings = servingsFor(meal, eaters.length);
    for (const id of [meal.recipeId!, ...meal.sideRecipeIds]) {
      const r = recipes.get(id);
      if (!r) continue;
      inputs.push({
        date: meal.date,
        title: r.title,
        baseServings: r.baseServings,
        servings,
        ingredients: r.ingredients,
        variants: r.variants.map((variant) => ({
          variant,
          portions: variantAudience(r, variant, eaters).length,
        })),
      });
    }
  }

  const lines = buildGroceryList(inputs);
  await db.transaction(async (tx) => {
    for (const line of lines) {
      const values = {
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        section: line.section,
        sources: line.sources,
        isStaple: line.isStaple,
        isStale: false,
      };
      await tx
        .insert(groceryItem)
        .values({ weekPlanId, key: line.key, isManual: false, ...values })
        .onConflictDoUpdate({ target: [groceryItem.weekPlanId, groceryItem.key], set: values });
    }
    const keep = lines.map((l) => l.key);
    const gone = and(
      eq(groceryItem.weekPlanId, weekPlanId),
      eq(groceryItem.isManual, false),
      keep.length ? notInArray(groceryItem.key, keep) : undefined,
    );
    await tx.delete(groceryItem).where(and(gone, eq(groceryItem.checked, false)));
    await tx.update(groceryItem).set({ isStale: true, sources: [] }).where(and(gone, eq(groceryItem.checked, true)));
  });
}

export async function listGroceryItems(db: Database, weekPlanId: string) {
  return db
    .select()
    .from(groceryItem)
    .where(eq(groceryItem.weekPlanId, weekPlanId))
    .orderBy(asc(groceryItem.name));
}

export async function recipeTitles(db: Database, ids: string[]) {
  if (ids.length === 0) return new Map<string, { title: string; slug: string }>();
  const rows = await db
    .select({ id: recipe.id, title: recipe.title, slug: recipe.slug })
    .from(recipe)
    .where(inArray(recipe.id, ids));
  return new Map(rows.map((r) => [r.id, { title: r.title, slug: r.slug }]));
}
