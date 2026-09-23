import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, familySettings } from "@/db/schema";
import { todayIn } from "@/lib/presence";
import { weekStartFor } from "@/lib/plan/week";
import { AiBudgetError } from "./errors";

/**
 * Keeps AI spending under the family's weekly budget. Every call is priced
 * from its token counts and logged; a call is refused once the week's
 * budget is used up. Scheduled (background) work stops earlier, at 80%, so
 * there's always budget left for things people ask for.
 */

/** Dollars per million tokens. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 3, output: 15 },
};
const WEB_SEARCH_CENTS = 1; // $10 per 1,000 searches
const BACKGROUND_SHARE = 0.8;

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function costCents(model: string, usage: TokenUsage): number {
  const price = PRICES[model] ?? PRICES["claude-opus-5"];
  const input =
    usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * 1.25 + (usage.cache_read_input_tokens ?? 0) * 0.1;
  const dollars = (input * price.input + usage.output_tokens * price.output) / 1_000_000;
  return dollars * 100 + (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_CENTS;
}

const background = new AsyncLocalStorage<boolean>();

/** Runs scheduled work so its AI calls count as background (and stop at 80% of the budget). */
export function inBackground<T>(work: () => Promise<T>): Promise<T> {
  return background.run(true, work);
}

/** The instant it's midnight on `date` in `timezone`. */
export function midnightIn(date: string, timezone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const asLocal = new Date(guess.toLocaleString("en-US", { timeZone: timezone }));
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (asUtc.getTime() - asLocal.getTime()));
}

async function weekWindow() {
  const [settings] = await db.select().from(familySettings).limit(1);
  const timezone = settings?.timezone ?? "America/Chicago";
  const weekStart = weekStartFor(todayIn(timezone), settings?.weekStartsOn ?? 0);
  return { since: midnightIn(weekStart, timezone), budget: settings?.aiWeeklyBudgetCents ?? 1000, weekStart };
}

export async function weekSpending() {
  const { since, budget, weekStart } = await weekWindow();
  const rows = await db
    .select({ feature: aiUsage.feature, cents: sql<number>`sum(${aiUsage.costCents})::float`, calls: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
    .groupBy(aiUsage.feature);
  const spent = rows.reduce((a, r) => a + r.cents, 0);
  return { weekStart, budgetCents: budget, spentCents: spent, byFeature: rows.sort((a, b) => b.cents - a.cents) };
}

/**
 * Throws AiBudgetError when this call would go over the week's budget.
 * `needCents` is what the call could cost, so an expensive job (a menu
 * lookup) doesn't start on the last few cents of the week.
 */
export async function checkBudget(needCents = 0): Promise<void> {
  const { budgetCents, spentCents } = await weekSpending();
  if (budgetCents <= 0) throw new AiBudgetError("AI features are turned off in Settings.");
  const limit = background.getStore() ? budgetCents * BACKGROUND_SHARE : budgetCents;
  if (spentCents + needCents >= limit) {
    throw new AiBudgetError(
      `This week's AI budget ($${(budgetCents / 100).toFixed(2)}) is used up. It resets at the start of next week, or a parent can raise it in Settings.`,
    );
  }
}

export async function recordUsage(feature: string, model: string, usage: TokenUsage): Promise<void> {
  try {
    await db.insert(aiUsage).values({
      feature,
      model,
      inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      outputTokens: usage.output_tokens,
      webSearches: usage.server_tool_use?.web_search_requests ?? 0,
      costCents: costCents(model, usage),
      background: Boolean(background.getStore()),
    });
  } catch (error) {
    // Never fail the user's request over bookkeeping.
    console.error("Recording AI usage failed", error);
  }
}
