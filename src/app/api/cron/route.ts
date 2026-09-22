import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { runScheduledJobs } from "@/lib/scheduler";

// Autopilot and recipe tweaks call Claude, which can take a minute or two.
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/** Called every 15 minutes by the scheduler (GitHub Actions) and daily by Vercel Cron. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const report = await runScheduledJobs(db);
  return NextResponse.json(report);
}
