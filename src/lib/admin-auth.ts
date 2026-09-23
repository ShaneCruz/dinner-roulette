import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The scheduler secret doubles as a maintenance key, so the family's data can
 * be inspected and repaired without a browser session. Restaurants increasingly
 * hide their menus inside ordering apps and design PDFs, and a menu that has to
 * be copied by hand tends not to get copied at all.
 *
 * Nothing in the app links to the routes that accept it; they are called by the
 * scheduler or by hand. Keep its reach to the menu data it exists for.
 */
export function adminRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
