import { timingSafeEqual } from "node:crypto";
import { desc, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { weekSpending } from "@/lib/ai/usage";

/**
 * What the AI has cost, so spending can be reviewed and tuned. Read-only,
 * behind the same secret as the scheduler, and it reports only features,
 * models, token counts and costs — no recipes, names or family data.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7), 1), 90);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 0), 200);
  const since = new Date(Date.now() - days * 86_400_000);

  const [week, byFeature, byModel, recent] = await Promise.all([
    weekSpending(),
    db
      .select({
        feature: aiUsage.feature,
        model: aiUsage.model,
        calls: sql<number>`count(*)::int`,
        cents: sql<number>`round(sum(${aiUsage.costCents})::numeric, 2)::float`,
        worstCents: sql<number>`round(max(${aiUsage.costCents})::numeric, 2)::float`,
        inputTokens: sql<number>`sum(${aiUsage.inputTokens})::int`,
        outputTokens: sql<number>`sum(${aiUsage.outputTokens})::int`,
        searches: sql<number>`sum(${aiUsage.webSearches})::int`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since))
      .groupBy(aiUsage.feature, aiUsage.model)
      .orderBy(sql`sum(${aiUsage.costCents}) desc`),
    db
      .select({ model: aiUsage.model, calls: sql<number>`count(*)::int`, cents: sql<number>`round(sum(${aiUsage.costCents})::numeric, 2)::float` })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since))
      .groupBy(aiUsage.model),
    limit
      ? db
          .select({
            at: aiUsage.createdAt,
            feature: aiUsage.feature,
            model: aiUsage.model,
            cents: sql<number>`round(${aiUsage.costCents}::numeric, 2)::float`,
            inputTokens: aiUsage.inputTokens,
            outputTokens: aiUsage.outputTokens,
            searches: aiUsage.webSearches,
            background: aiUsage.background,
          })
          .from(aiUsage)
          .orderBy(desc(aiUsage.createdAt))
          .limit(limit)
      : Promise.resolve([]),
  ]);

  const totalCents = byFeature.reduce((sum, row) => sum + row.cents, 0);
  return NextResponse.json({
    thisWeek: { budgetCents: week.budgetCents, spentCents: Math.round(week.spentCents * 100) / 100, weekStart: week.weekStart },
    lastDays: { days, totalCents: Math.round(totalCents * 100) / 100, byFeature, byModel },
    recent,
  });
}
