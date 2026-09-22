import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { member, memberAvailability } from "@/db/schema";
import { readSchoolCalendar, type CalendarSource } from "@/lib/ai/calendar";
import { aiEnabled, friendlyAiError } from "@/lib/ai/claude";
import { todayIn } from "@/lib/presence";
import { getActingMember, getFamilySettings, getParentSession } from "@/lib/session";

// Reading a calendar PDF can take a minute.
export const maxDuration = 300;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Reads a calendar and returns proposed date ranges. Nothing is saved until a parent reviews them. */
export async function POST(request: Request, { params }: RouteContext<"/api/members/[id]/calendar">) {
  if (!(await getParentSession())) return fail("Please sign in again.", 401);
  const acting = await getActingMember();
  if (acting?.role !== "parent") return fail("Only parents can import calendars.", 403);
  if (!aiEnabled()) return fail("AI isn't set up yet. Add ANTHROPIC_API_KEY to turn it on.", 503);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown person.", 404);
  const [who] = await db.select().from(member).where(and(eq(member.id, id), isNull(member.archivedAt)));
  if (!who) return fail("Unknown person.", 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("That upload was too big. PDFs need to be under 4 MB.", 413);
  }
  const hint = String(form.get("hint") ?? "").slice(0, 1000);
  const text = String(form.get("text") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  let source: CalendarSource;
  if (files.length) {
    if (files.some((f) => f.size > MAX_FILE_BYTES)) return fail("Each file needs to be under 4 MB.");
    if (files[0].type === "application/pdf") {
      source = { kind: "pdf", data: Buffer.from(await files[0].arrayBuffer()).toString("base64") };
    } else {
      if (files.length > 6) return fail("Up to 6 photos at a time, please.");
      const images = [];
      for (const file of files) {
        if (!IMAGE_TYPES.includes(file.type as ImageType)) return fail("Use a PDF or a photo (JPEG, PNG, WebP).");
        images.push({ mediaType: file.type as ImageType, data: Buffer.from(await file.arrayBuffer()).toString("base64") });
      }
      source = { kind: "images", images };
    }
  } else if (text.length >= 20) {
    source = { kind: "text", text: text.slice(0, 60_000) };
  } else {
    return fail("Upload the calendar PDF or a photo, or paste its dates.");
  }

  const settings = await getFamilySettings();
  const today = todayIn(settings?.timezone ?? "America/Chicago");
  try {
    const result = await readSchoolCalendar(source, { boarding: who.defaultPresence === "away", today, hint });
    if (!result.found) return fail(result.problem ?? "That doesn't look like a school calendar.", 422);
    const existing = await db.select().from(memberAvailability).where(eq(memberAvailability.memberId, id));
    const periods = result.periods
      .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(p.endDate))
      .filter((p) => p.endDate >= today)
      .map((p) => ({
        ...p,
        endDate: p.endDate < p.startDate ? p.startDate : p.endDate,
        // Already on the calendar (same presence, overlapping dates)?
        duplicate: existing.some(
          (e) => e.presence === p.presence && e.startDate <= p.endDate && e.endDate >= p.startDate,
        ),
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return NextResponse.json({ schoolYear: result.schoolYear, periods });
  } catch (error) {
    console.error("Calendar import failed", error);
    return fail(friendlyAiError(error), 502);
  }
}
