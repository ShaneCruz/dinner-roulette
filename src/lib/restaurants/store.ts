import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { friendlyAiError } from "@/lib/ai/claude";
import { researchRestaurant } from "@/lib/ai/restaurants";
import type { Database } from "@/db";
import { familySettings, member, memberFoodRule, plannedMeal, rating, recipe, restaurant } from "@/db/schema";
import type { RestaurantFavorites } from "@/db/schema";
import { sharedItems } from "@/lib/restaurants/favorites";
import type { Diner } from "@/lib/ai/restaurants";
import { locateZip } from "@/lib/weather";

export type Restaurant = typeof restaurant.$inferSelect;

export async function listRestaurants(db: Database): Promise<Restaurant[]> {
  return db.select().from(restaurant).where(isNull(restaurant.archivedAt)).orderBy(asc(restaurant.name));
}

export async function getRestaurant(db: Database, id: string): Promise<Restaurant | null> {
  const [found] = await db.select().from(restaurant).where(eq(restaurant.id, id)).limit(1);
  return found ?? null;
}

/** When each restaurant was last ordered from, for the wheel ("had it Tuesday"). */
export async function lastOrdered(db: Database): Promise<Map<string, string>> {
  const rows = await db
    .select({ restaurantId: plannedMeal.restaurantId, date: plannedMeal.date })
    .from(plannedMeal)
    .where(isNotNull(plannedMeal.restaurantId))
    .orderBy(desc(plannedMeal.date));
  const result = new Map<string, string>();
  for (const row of rows) if (row.restaurantId && !result.has(row.restaurantId)) result.set(row.restaurantId, row.date);
  return result;
}

/** Everyone in the family, described by what they eat, for dish picks. */
export async function loadDiners(db: Database): Promise<Diner[]> {
  const [members, nopes, loved] = await Promise.all([
    db.select().from(member).where(isNull(member.archivedAt)).orderBy(asc(member.sortOrder)),
    db.select().from(memberFoodRule).where(and(eq(memberFoodRule.kind, "nope"), isNotNull(memberFoodRule.ingredient))),
    db
      .select({ memberId: rating.memberId, title: recipe.title })
      .from(rating)
      .innerJoin(recipe, eq(recipe.id, rating.recipeId))
      .where(gte(rating.stars, 4)),
  ]);
  return members.map((m) => ({
    memberId: m.id,
    isKid: m.role === "kid",
    spiceTolerance: m.spiceTolerance,
    nopes: nopes.filter((n) => n.memberId === m.id).map((n) => n.ingredient!),
    prefersHighProtein: m.prefersHighProtein,
    wantsHealthy: m.wantsHealthySwaps,
    favorites: [...new Set(loved.filter((l) => l.memberId === m.id).map((l) => l.title))],
  }));
}

/** "Lake Forest, IL (60045)", to find the right location of a chain. */
export async function familyLocation(db: Database): Promise<string | null> {
  const [settings] = await db.select().from(familySettings).limit(1);
  if (!settings?.homeZip) return null;
  const place = await locateZip(settings.homeZip);
  return place ? `${place.city}, ${place.state} (${settings.homeZip})` : settings.homeZip;
}

/** A menu lookup started recently enough to still be running. */
export const RESEARCH_STUCK_MINUTES = 8;

export function isResearchRunning(place: { researchStartedAt: Date | null }, now = new Date()): boolean {
  return Boolean(place.researchStartedAt && now.getTime() - place.researchStartedAt.getTime() < RESEARCH_STUCK_MINUTES * 60_000);
}

/**
 * Finishes menu lookups that were started but never completed (the phone
 * went to sleep, the request was cut off). The scheduler calls this, so a
 * lookup always lands even if the browser walked away.
 */
export async function finishStuckResearch(db: Database, now = new Date(), olderThanMinutes = 3): Promise<number> {
  const waiting = await db
    .select()
    .from(restaurant)
    .where(and(isNotNull(restaurant.researchStartedAt), isNull(restaurant.archivedAt)));
  const stale = waiting.filter(
    (place) => place.researchStartedAt && now.getTime() - place.researchStartedAt.getTime() > olderThanMinutes * 60_000,
  );
  let done = 0;
  for (const place of stale.slice(0, 2)) {
    // Too old to still be a real attempt: let someone retry it by hand.
    if (now.getTime() - place.researchStartedAt!.getTime() > 60 * 60_000) {
      await db
        .update(restaurant)
        .set({ researchStartedAt: null, researchError: "That lookup didn't finish. Try again." })
        .where(eq(restaurant.id, place.id));
      continue;
    }
    try {
      const [diners, location] = await Promise.all([loadDiners(db), familyLocation(db)]);
      const result = await researchRestaurant(place, diners, location, usualDishes(place.favorites));
      await db
        .update(restaurant)
        .set(
          "error" in result
            ? { researchError: result.error, researchStartedAt: null }
            : { research: result, researchedAt: new Date(), researchError: null, researchStartedAt: null },
        )
        .where(eq(restaurant.id, place.id));
      done++;
    } catch (error) {
      console.error("Finishing a menu lookup failed", error);
      await db
        .update(restaurant)
        .set({ researchError: friendlyAiError(error), researchStartedAt: null })
        .where(eq(restaurant.id, place.id));
    }
  }
  return done;
}

/** Every dish the family has saved as a usual at this place. */
export function usualDishes(favorites: RestaurantFavorites | null): string[] {
  if (!favorites) return [];
  const all = [
    ...Object.values(favorites.people).flatMap((p) => p.dishes),
    ...sharedItems(favorites).map((s) => s.dish),
  ];
  return [...new Map(all.map((d) => [d.toLowerCase(), d])).values()].slice(0, 20);
}
