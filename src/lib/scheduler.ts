import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { DEFAULT_REMINDERS, familySettings, member, rating, recipe, recipeIngredient, recipeProposal } from "@/db/schema";
import { backfillNutrition } from "@/lib/nutrition-store";
import { eatersFor, loadEaterContext, loadMeals } from "@/lib/plan/store";
import { addDays, todayIn } from "@/lib/presence";
import { finishStuckIdeas } from "@/lib/recipes/ideas";
import { scanForProposals } from "@/lib/recipes/proposals";
import { dueReminders, minutesIn, type ReminderMeal } from "@/lib/reminders";
import { runAutopilot } from "@/lib/suggest/autopilot";
import { sendOnce, sendToMembers } from "./push";

/**
 * Everything that happens on its own, run every 15 minutes by the scheduler:
 * reminders, Friday autopilot, recipe tweaks from new ratings, and filling
 * in missing nutrition. Each job is independent, so one failing doesn't
 * stop the others.
 */
export async function runScheduledJobs(db: Database, now = new Date()) {
  const [settings] = await db.select().from(familySettings).limit(1);
  if (!settings?.setupCompletedAt) return { skipped: "setup not finished" };
  const prefs = { ...DEFAULT_REMINDERS, ...settings.reminders };
  const today = todayIn(settings.timezone, now);
  const nowMinutes = minutesIn(settings.timezone, now);
  const parents = (
    await db.select({ id: member.id }).from(member).where(and(eq(member.role, "parent"), isNull(member.archivedAt)))
  ).map((m) => m.id);
  const report: Record<string, unknown> = { today, nowMinutes };

  const job = async (name: string, work: () => Promise<unknown>) => {
    try {
      report[name] = await work();
    } catch (error) {
      console.error(`Scheduled job ${name} failed`, error);
      report[name] = "failed";
    }
  };

  await job("reminders", async () => {
    const tomorrow = addDays(today, 1);
    const meals = await loadMeals(db, today, tomorrow);
    const context = await loadEaterContext(db, today, tomorrow);
    const describe = async (date: string): Promise<ReminderMeal | null> => {
      const meal = meals.get(date);
      if (!meal || meal.nightType !== "cook" || !meal.recipeId) return null;
      const [dish] = await db
        .select({ title: recipe.title, slug: recipe.slug, totalMinutes: recipe.totalMinutes })
        .from(recipe)
        .where(eq(recipe.id, meal.recipeId));
      if (!dish) return null;
      const proteins = await db
        .select({ name: recipeIngredient.name })
        .from(recipeIngredient)
        .where(and(eq(recipeIngredient.recipeId, meal.recipeId), inArray(recipeIngredient.section, ["meat", "seafood"]), eq(recipeIngredient.optional, false)));
      const rated = await db.select({ memberId: rating.memberId }).from(rating).where(eq(rating.plannedMealId, meal.id));
      return {
        id: meal.id,
        date,
        status: meal.status,
        ...dish,
        proteins: [...new Set(proteins.map((p) => p.name))].slice(0, 3),
        eaterIds: eatersFor(context, date, meal.eaterIds).map((m) => m.id),
        ratedIds: rated.map((r) => r.memberId),
      };
    };
    const due = dueReminders({
      prefs,
      dinnerTime: settings.dinnerTime,
      nowMinutes,
      today: await describe(today),
      tomorrow: await describe(tomorrow),
    });
    let sent = 0;
    for (const r of due) {
      if (await sendOnce(db, r.key, r.to === "parents" ? parents : r.to, { title: r.title, body: r.body, url: r.url, tag: r.key })) sent++;
    }
    return sent;
  });

  await job("autopilot", async () => {
    const result = await runAutopilot(db, {
      today,
      nowMinutes,
      weekStartsOn: settings.weekStartsOn,
      autopilotDay: settings.autopilotDay,
      enabled: settings.autopilotEnabled,
    });
    if (!result) return null;
    if (prefs.autopilot) {
      await sendToMembers(db, parents, {
        title: result.filled ? "🗓️ Next week is planned" : "🗓️ Next week was already planned",
        body: result.lines.join("\n"),
        url: `/plan?week=${result.weekStart}`,
        tag: `autopilot:${result.weekStart}`,
      });
    }
    return result.filled;
  });

  await job("proposals", async () => {
    const made = await scanForProposals(db, new Date(now.getTime() - 7 * 86_400_000), new Date(now.getTime() - 3 * 3_600_000));
    if (made && prefs.proposals) {
      const pending = await db
        .select({ id: recipeProposal.id, title: recipe.title, slug: recipe.slug, summary: recipeProposal.summary })
        .from(recipeProposal)
        .innerJoin(recipe, eq(recipe.id, recipeProposal.recipeId))
        .where(eq(recipeProposal.status, "pending"));
      for (const p of pending) {
        await sendOnce(db, `proposal:${p.id}`, parents, {
          title: `✨ A tweak for ${p.title}`,
          body: p.summary,
          url: `/recipes/${p.slug}`,
          tag: `proposal:${p.id}`,
        });
      }
    }
    return made;
  });

  await job("ideas", () => finishStuckIdeas(db, now));
  await job("nutrition", () => backfillNutrition(db, 10));
  return report;
}
