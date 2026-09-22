import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { weekPlan } from "@/db/schema";
import { applyGroceryOp, groceryOpSchema, grocerySnapshot } from "@/lib/grocery/store";
import { getActingMember, getParentSession } from "@/lib/session";

// Plain route handlers (not server actions) so a phone that's been sitting
// in the store with an old copy of the page keeps syncing across deploys.

async function authorize(weekPlanId: string) {
  if (!(await getParentSession())) return null;
  if (!/^[0-9a-f-]{36}$/i.test(weekPlanId)) return null;
  const [plan] = await db.select({ id: weekPlan.id }).from(weekPlan).where(eq(weekPlan.id, weekPlanId)).limit(1);
  return plan ?? null;
}

export async function GET(_request: Request, { params }: RouteContext<"/api/grocery/[weekPlanId]">) {
  const { weekPlanId } = await params;
  if (!(await authorize(weekPlanId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await grocerySnapshot(db, weekPlanId), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request, { params }: RouteContext<"/api/grocery/[weekPlanId]">) {
  const { weekPlanId } = await params;
  if (!(await authorize(weekPlanId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const ops = groceryOpSchema.array().max(200).safeParse(body?.ops);
  if (!ops.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const acting = await getActingMember();
  for (const op of ops.data) await applyGroceryOp(db, weekPlanId, acting?.id ?? null, op);
  return NextResponse.json(await grocerySnapshot(db, weekPlanId), {
    headers: { "Cache-Control": "no-store" },
  });
}
