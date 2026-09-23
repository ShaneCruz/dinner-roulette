import { and, eq, isNull } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { researchRestaurant } from "@/lib/ai/restaurants";
import { familyLocation, getRestaurant, isResearchRunning, loadDiners, usualDishes } from "@/lib/restaurants/store";
import { getActingMember, getParentSession } from "@/lib/session";

// Searching the web for a menu takes a minute or two.
export const maxDuration = 300;

type Status = "running" | "done" | "error" | "idle";

function statusOf(place: { research: unknown; researchError: string | null; researchStartedAt: Date | null }): Status {
  if (isResearchRunning(place)) return "running";
  if (place.research) return "done";
  if (place.researchError) return "error";
  return "idle";
}

async function requireParent() {
  if (!(await getParentSession())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const acting = await getActingMember();
  if (acting?.role !== "parent") return NextResponse.json({ error: "Only parents can do this." }, { status: 403 });
  return null;
}

/** How the lookup is going, for a page that's checking back. */
export async function GET(_request: Request, { params }: RouteContext<"/api/restaurants/[id]/research">) {
  const denied = await requireParent();
  if (denied) return denied;
  const { id } = await params;
  const place = /^[0-9a-f-]{36}$/i.test(id) ? await getRestaurant(db, id) : null;
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status: statusOf(place), error: place.researchError });
}

/**
 * Starts a menu lookup and answers straight away. The work carries on
 * server-side, so leaving the app doesn't cancel it (or waste what it
 * already cost), and a lookup that's already running is never started twice.
 */
export async function POST(_request: Request, { params }: RouteContext<"/api/restaurants/[id]/research">) {
  const denied = await requireParent();
  if (denied) return denied;
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't set up yet." }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const place = await getRestaurant(db, id);
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (statusOf(place) === "running") return NextResponse.json({ status: "running" });

  // Claim it: whoever sets the start time owns this lookup.
  const claimed = await db
    .update(restaurant)
    .set({ researchStartedAt: new Date(), researchError: null })
    .where(and(eq(restaurant.id, id), isNull(restaurant.researchStartedAt)))
    .returning({ id: restaurant.id });
  if (!claimed.length) {
    const fresh = await getRestaurant(db, id);
    if (fresh && statusOf(fresh) === "running") return NextResponse.json({ status: "running" });
    // An old start time from a lookup that died; take it over.
    await db.update(restaurant).set({ researchStartedAt: new Date(), researchError: null }).where(eq(restaurant.id, id));
  }

  after(async () => {
    try {
      const [diners, location] = await Promise.all([loadDiners(db), familyLocation(db)]);
      const result = await researchRestaurant(place, diners, location, usualDishes(place.favorites));
      if ("error" in result) {
        await db.update(restaurant).set({ researchError: result.error, researchStartedAt: null }).where(eq(restaurant.id, id));
        return;
      }
      await db
        .update(restaurant)
        .set({ research: result, researchedAt: new Date(), researchError: null, researchStartedAt: null })
        .where(eq(restaurant.id, id));
    } catch (error) {
      console.error("Restaurant research failed", error);
      await db
        .update(restaurant)
        .set({ researchError: friendlyAiError(error), researchStartedAt: null })
        .where(eq(restaurant.id, id));
    }
  });

  return NextResponse.json({ status: "running" });
}
