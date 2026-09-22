import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushConfigured, removeSubscription, saveSubscription, sendToMembers } from "@/lib/push";
import { getActingMember, getParentSession } from "@/lib/session";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: subscriptionSchema }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.url().max(2000) }),
  z.object({ action: z.literal("test") }),
]);

/** Turns reminders on or off for this device, for whoever is using it. */
export async function POST(request: Request) {
  if (!(await getParentSession())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const acting = await getActingMember();
  if (!acting) return NextResponse.json({ error: "Pick who you are first." }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Reminders aren't set up on the server yet." }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That didn't make sense." }, { status: 400 });

  if (parsed.data.action === "subscribe") {
    await saveSubscription(db, acting.id, parsed.data.subscription, request.headers.get("user-agent"));
  } else if (parsed.data.action === "unsubscribe") {
    await removeSubscription(db, parsed.data.endpoint);
  } else {
    const sent = await sendToMembers(db, [acting.id], {
      title: "🔔 Reminders are on!",
      body: `Nice, ${acting.name}. This is what a dinner reminder looks like.`,
      url: "/",
      tag: "test",
    });
    if (!sent) return NextResponse.json({ error: "Couldn't reach this device. Try turning reminders off and on." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
