import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import type { Database } from "@/db";
import { notificationLog, pushSubscription } from "@/db/schema";

/**
 * Phone reminders over Web Push. Works in Android Chrome and, on iPhone,
 * once the site is added to the Home Screen (iOS 16.4+).
 */

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:dinner-roulette@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export async function saveSubscription(
  db: Database,
  memberId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
) {
  await db
    .insert(pushSubscription)
    .values({ memberId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent, failures: 0 })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { memberId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent, failures: 0, updatedAt: new Date() },
    });
}

export async function removeSubscription(db: Database, endpoint: string) {
  await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
}

/** Sends to every device of these people. Returns how many devices got it. */
export async function sendToMembers(db: Database, memberIds: string[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || !memberIds.length) return 0;
  configure();
  const subs = await db.select().from(pushSubscription).where(inArray(pushSubscription.memberId, memberIds));
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: "high" },
        );
        sent++;
        if (sub.failures) await db.update(pushSubscription).set({ failures: 0 }).where(eq(pushSubscription.id, sub.id));
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // Gone: the browser unsubscribed or the app was removed.
        if (status === 404 || status === 410 || sub.failures >= 5) {
          await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));
        } else {
          await db
            .update(pushSubscription)
            .set({ failures: sql`${pushSubscription.failures} + 1` })
            .where(eq(pushSubscription.id, sub.id));
        }
      }
    }),
  );
  return sent;
}

/** Sends a reminder only the first time its key is seen. */
export async function sendOnce(db: Database, key: string, memberIds: string[], payload: PushPayload): Promise<boolean> {
  const claimed = await db.insert(notificationLog).values({ key }).onConflictDoNothing().returning({ key: notificationLog.key });
  if (!claimed.length) return false;
  await sendToMembers(db, memberIds, payload);
  return true;
}
