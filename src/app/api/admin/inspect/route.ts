import { desc, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recipe, restaurant } from "@/db/schema";
import { usualDishes } from "@/lib/restaurants/store";
import { findDish } from "@/lib/restaurants/favorites";
import { adminRequest } from "@/lib/admin-auth";

/**
 * A read-only window into the family's data for debugging: what's saved
 * against what the menu lookup found, and whether the two line up. Behind
 * the scheduler secret, and it never writes anything.
 */
export async function GET(request: Request) {
  if (!adminRequest(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
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
          id: place.id,
          name: place.name,
          menuFrom: place.research?.menuFrom ?? null,
          cuisine: place.cuisine,
          website: place.website,
          researchedAt: place.researchedAt,
          researchStartedAt: place.researchStartedAt,
          researchError: place.researchError,
          menuDishes: dishes.map((d) => ({ name: d.name, price: d.price })),
          usuals: usuals.map((ours) => ({
            ours,
            // The same call the app makes, so this reports what people see.
            matched: findDish(ours, dishes)?.name ?? null,
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

  const places = await db
    .select({ id: restaurant.id, name: restaurant.name })
    .from(restaurant)
    .orderBy(desc(restaurant.createdAt));
  return NextResponse.json({ restaurants: places, hint: "?restaurant=<name> or ?recipe=<slug>" });
}
