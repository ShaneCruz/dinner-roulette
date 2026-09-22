import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { researchRestaurant } from "@/lib/ai/restaurants";
import { familyLocation, getRestaurant, loadDiners } from "@/lib/restaurants/store";
import { getActingMember, getParentSession } from "@/lib/session";

// Searching the web for a menu takes a minute or two.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: RouteContext<"/api/restaurants/[id]/research">) {
  if (!(await getParentSession())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const acting = await getActingMember();
  if (acting?.role !== "parent") return NextResponse.json({ error: "Only parents can do this." }, { status: 403 });
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't set up yet." }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const place = await getRestaurant(db, id);
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const [diners, location] = await Promise.all([loadDiners(db), familyLocation(db)]);
    const result = await researchRestaurant(place, diners, location);
    if ("error" in result) {
      await db.update(restaurant).set({ researchError: result.error }).where(eq(restaurant.id, id));
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    await db
      .update(restaurant)
      .set({ research: result, researchedAt: new Date(), researchError: null })
      .where(eq(restaurant.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Restaurant research failed", error);
    const message = friendlyAiError(error);
    await db.update(restaurant).set({ researchError: message }).where(eq(restaurant.id, id));
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
