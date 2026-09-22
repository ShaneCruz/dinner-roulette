import "server-only";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { member, memberAvailability, memberFoodRule, pushSubscription, rating, recipe, restaurant, sessionVote } from "@/db/schema";

/**
 * What's left to set up, worked out from the family's actual data so steps
 * tick themselves off as they're done. Shown to parents on the Tonight page
 * until everything is finished.
 */

export type SetupStep = { id: string; label: string; detail: string; href: string; done: boolean };

const total = async (db: Database, query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0;

export async function loadSetupSteps(db: Database, memberId: string): Promise<SetupStep[]> {
  const [ourRecipes, mains, rules, places, votes, ratings, reminders, boarders] = await Promise.all([
    total(db, db.select({ n: count() }).from(recipe).where(and(ne(recipe.source, "starter"), isNull(recipe.archivedAt)))),
    total(db, db.select({ n: count() }).from(recipe).where(and(eq(recipe.kind, "main"), isNull(recipe.archivedAt)))),
    total(db, db.select({ n: count() }).from(memberFoodRule)),
    total(db, db.select({ n: count() }).from(restaurant).where(isNull(restaurant.archivedAt))),
    total(db, db.select({ n: count() }).from(sessionVote)),
    total(db, db.select({ n: count() }).from(rating)),
    total(db, db.select({ n: count() }).from(pushSubscription).where(eq(pushSubscription.memberId, memberId))),
    db
      .select({ id: member.id, name: member.name })
      .from(member)
      .where(and(eq(member.defaultPresence, "away"), isNull(member.archivedAt))),
  ]);

  const steps: SetupStep[] = [
    {
      id: "recipes",
      label: "Add 3 dinners you already make",
      detail: "Snap the recipe card or paste it in. These are the ones everyone actually eats.",
      href: "/recipes/import",
      done: ourRecipes >= 3,
    },
    {
      id: "rules",
      label: "Say what nobody eats",
      detail: "Add each person's never-eats and favorites so suggestions don't miss.",
      href: "/family",
      done: rules > 0,
    },
  ];

  for (const boarder of boarders) {
    const dates = await total(
      db,
      db.select({ n: count() }).from(memberAvailability).where(eq(memberAvailability.memberId, boarder.id)),
    );
    steps.push({
      id: `calendar-${boarder.id}`,
      label: `Upload ${boarder.name}'s school calendar`,
      detail: `Then ${boarder.name} is counted on the nights she's home, and gets First Pick when she's back.`,
      href: `/family/${boarder.id}`,
      done: dates > 0,
    });
  }

  steps.push(
    {
      id: "reminders",
      label: "Turn on reminders for this phone",
      detail: "Thaw the meat, start cooking, rate it. Add the app to your Home Screen first on an iPhone.",
      href: "/settings",
      done: reminders > 0,
    },
    {
      id: "discover",
      label: "Swipe up more dinners in Discover",
      detail: "More dinners means better suggestions and a fuller wheel.",
      href: "/recipes/discover",
      done: mains >= 25,
    },
    {
      id: "takeout",
      label: "Add your takeout spots",
      detail: "Menus, everyone's usual order, and a wheel for nights nobody cooks.",
      href: "/takeout",
      done: places > 0,
    },
    {
      id: "session",
      label: "Run a Sunday session",
      detail: "Pass the phone, everyone swipes, the week plans itself.",
      href: "/session",
      done: votes > 0,
    },
    {
      id: "rate",
      label: "Rate your first dinner",
      detail: "This is what teaches the planner. Ten seconds after dinner.",
      href: "/history",
      done: ratings > 0,
    },
  );
  return steps;
}
