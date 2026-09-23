import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { menuFromText } from "@/lib/ai/restaurants";
import { getRestaurant, loadDiners, usualDishes } from "@/lib/restaurants/store";
import { getActingMember, getParentSession } from "@/lib/session";

// Reading a long menu takes a few seconds.
export const maxDuration = 120;

/**
 * Reads a menu the family pasted in. Ordering sites (Toast, DoorDash) are
 * apps rather than pages, so search can't see their menus: pasting is the
 * reliable way in, and it's a fraction of the cost of searching.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/restaurants/[id]/menu">) {
  if (!(await getParentSession())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const acting = await getActingMember();
  if (acting?.role !== "parent") return NextResponse.json({ error: "Only parents can do this." }, { status: 403 });
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't set up yet." }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const place = await getRestaurant(db, id);
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 40) return NextResponse.json({ error: "Paste a bit more of the menu." }, { status: 400 });

  try {
    const diners = await loadDiners(db);
    const result = await menuFromText(text, diners, usualDishes(place.favorites), place.website);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });
    // Keep anything the earlier lookup found that the pasted menu doesn't mention.
    const pasted = new Set(result.dishes.map((d) => d.name.toLowerCase()));
    const kept = (place.research?.dishes ?? []).filter((d) => !pasted.has(d.name.toLowerCase()));
    await db
      .update(restaurant)
      .set({
        research: { ...result, dishes: [...result.dishes, ...kept].slice(0, 40) },
        researchedAt: new Date(),
        researchError: null,
        researchStartedAt: null,
      })
      .where(eq(restaurant.id, id));
    return NextResponse.json({ dishes: result.dishes.length });
  } catch (error) {
    console.error("Reading a pasted menu failed", error);
    return NextResponse.json({ error: friendlyAiError(error) }, { status: 502 });
  }
}
