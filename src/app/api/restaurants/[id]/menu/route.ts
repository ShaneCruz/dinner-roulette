import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { restaurant } from "@/db/schema";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { menuFromSource, type MenuSource } from "@/lib/ai/restaurants";
import { getRestaurant, loadDiners, menuFromFamily, usualDishes } from "@/lib/restaurants/store";
import { getActingMember, getParentSession } from "@/lib/session";
import { adminRequest } from "@/lib/admin-auth";

// Reading a long menu (or a few photos of one) takes a little while.
export const maxDuration = 300;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Reads a menu the family supplied. Ordering sites (Toast, DoorDash) are apps
 * rather than pages, and plenty of menus are design PDFs, so search can't see
 * either: supplying the menu is the reliable way in, and it's a fraction of
 * the cost of searching.
 *
 * The maintenance key can post one too, so a menu can be repaired from outside
 * the app rather than waiting on someone to copy it out by hand.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/restaurants/[id]/menu">) {
  if (!adminRequest(request)) {
    if (!(await getParentSession())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const acting = await getActingMember();
    if (acting?.role !== "parent") return NextResponse.json({ error: "Only parents can do this." }, { status: 403 });
  }
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't set up yet." }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const place = await getRestaurant(db, id);
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let source: MenuSource;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "That upload was too big. Photos are shrunk automatically; PDFs need to be under 4 MB." }, { status: 413 });
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: "Pick a photo or PDF of the menu." }, { status: 400 });
    if (files.some((f) => f.size > 4 * 1024 * 1024)) return NextResponse.json({ error: "Each file needs to be under 4 MB." }, { status: 400 });
    if (files[0].type === "application/pdf") {
      source = { kind: "pdf", data: Buffer.from(await files[0].arrayBuffer()).toString("base64") };
    } else {
      if (files.length > 8) return NextResponse.json({ error: "Up to 8 photos at a time, please." }, { status: 400 });
      const images = [];
      for (const file of files) {
        if (!IMAGE_TYPES.includes(file.type as ImageType)) return NextResponse.json({ error: "Photos need to be JPEG, PNG or WebP." }, { status: 400 });
        images.push({ mediaType: file.type as ImageType, data: Buffer.from(await file.arrayBuffer()).toString("base64") });
      }
      source = { kind: "images", images };
    }
  } else {
    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 40) return NextResponse.json({ error: "Paste a bit more of the menu." }, { status: 400 });
    source = { kind: "text", text };
  }

  try {
    const diners = await loadDiners(db);
    const result = await menuFromSource(source, diners, usualDishes(place.favorites), place.website);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });
    await db
      .update(restaurant)
      .set({
        research: menuFromFamily(place.research, result),
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
