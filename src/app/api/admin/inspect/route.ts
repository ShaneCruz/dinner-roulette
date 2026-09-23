import { timingSafeEqual } from "node:crypto";
import { desc, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recipe, restaurant } from "@/db/schema";
import { usualDishes } from "@/lib/restaurants/store";
import { sameDish } from "@/lib/restaurants/favorites";

/**
 * A read-only window into the family's data for debugging: what's saved
 * against what the menu lookup found, and whether the two line up. Behind
 * the scheduler secret, and it never writes anything.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const url = new URL(request.url);
  const name = url.searchParams.get("restaurant");
  const recipeSlug = url.searchParams.get("recipe");

  if (name) {
    const places = await db.select().from(restaurant).where(ilike(restaurant.name, `%${name}%`)).limit(3);
    return NextResponse.json({
      restaurants: places.map((place) => {
        const dishes = place.research?.dishes ?? [];
        const usuals = usualDishes(place.favorites);
        return {
          name: place.name,
          cuisine: place.cuisine,
          website: place.website,
          researchedAt: place.researchedAt,
          researchStartedAt: place.researchStartedAt,
          researchError: place.researchError,
          menuDishes: dishes.map((d) => ({ name: d.name, price: d.price })),
          usuals: usuals.map((ours) => ({
            ours,
            matched: dishes.find((d) => sameDish(d.name, ours))?.name ?? null,
          })),
        };
      }),
    });
  }

  if (recipeSlug) {
    const [found] = await db.select().from(recipe).where(ilike(recipe.slug, `%${recipeSlug}%`)).limit(1);
    if (!found) return NextResponse.json({ error: "No such recipe" }, { status: 404 });
    return NextResponse.json({
      recipe: {
        slug: found.slug,
        title: found.title,
        status: found.status,
        source: found.source,
        sourceUrl: found.sourceUrl,
        rating: { site: found.sourceName, stars: found.sourceRating, count: found.sourceRatingCount },
        nutrition: found.nutrition,
        steps: found.steps.length,
      },
    });
  }

  const places = await db.select({ name: restaurant.name }).from(restaurant).orderBy(desc(restaurant.createdAt));
  return NextResponse.json({ restaurants: places.map((p) => p.name), hint: "?restaurant=<name> or ?recipe=<slug>" });
}
