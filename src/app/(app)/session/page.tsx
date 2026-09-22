import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { Card, PageHeader, cx } from "@/components/ui";
import { db } from "@/db";
import { recipe } from "@/db/schema";
import { loadSession } from "@/lib/fun/session";
import { formatDay, weekDates, weekStartFor } from "@/lib/plan/week";
import { addDays, formatDateRange, todayIn } from "@/lib/presence";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { SessionGame } from "./session-game";

export const metadata = { title: "Sunday session" };

export default async function SessionPage({ searchParams }: PageProps<"/session">) {
  const { settings, acting } = await requireActingMember();
  const params = await searchParams;
  const today = todayIn(settings.timezone);
  const thisWeek = weekStartFor(today, settings.weekStartsOn);
  const nextWeek = addDays(thisWeek, 7);
  // Late in the week, the session is about next week.
  const daysLeft = weekDates(thisWeek).filter((d) => d >= today).length;
  const defaultWeek = daysLeft <= 2 ? nextWeek : thisWeek;
  const weekStart = params.week === "next" ? nextWeek : params.week === "this" ? thisWeek : defaultWeek;

  const [members, session, mains] = await Promise.all([
    getActiveMembers(),
    loadSession(db, weekStart, today),
    db
      .select({ id: recipe.id, title: recipe.title })
      .from(recipe)
      .where(and(eq(recipe.kind, "main"), eq(recipe.status, "approved"), isNull(recipe.archivedAt)))
      .orderBy(asc(recipe.title)),
  ]);
  const dates = weekDates(weekStart);
  const upcoming = [...weekDates(thisWeek), ...weekDates(nextWeek)].filter((d) => d >= today).slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Sunday session 🎉"
        subtitle={`Swipe on dinners for ${formatDateRange(dates[0], dates[6])}. Everyone votes, the planner listens.`}
      />
      <div className="flex gap-2 text-sm" role="tablist" aria-label="Which week">
        {[
          { key: "this", label: "This week", start: thisWeek },
          { key: "next", label: "Next week", start: nextWeek },
        ].map((w) => (
          <Link
            key={w.key}
            href={`/session?week=${w.key}`}
            aria-current={w.start === weekStart ? "page" : undefined}
            className={cx(
              "rounded-full border px-4 py-1.5 font-semibold",
              w.start === weekStart ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border text-muted",
            )}
          >
            {w.label}
          </Link>
        ))}
      </div>

      {session.openNights.length === 0 && session.cards.length === 0 ? (
        <Card className="text-center">
          <p className="text-lg font-bold">Every night that week is already decided.</p>
          <p className="mt-1 text-sm text-muted">
            Nothing left to vote on. Clear a night on the plan to put it back up for grabs.
          </p>
          <Link href="/plan" className="mt-3 inline-block font-semibold text-tomato underline">
            Open the plan
          </Link>
        </Card>
      ) : null}

      <SessionGame
        key={weekStart}
        weekStart={weekStart}
        openNights={session.openNights.map((d) => formatDay(d))}
        cards={session.cards}
        players={members.map((m) => ({
          id: m.id,
          name: m.name,
          emoji: m.avatarEmoji,
          color: m.avatarColor,
          role: m.role,
          title: m.chefTitle,
          tone: m.humorDial,
          eating: session.eatingIds.has(m.id),
        }))}
        initialVotes={session.votes}
        initialVetoes={session.vetoes}
        initialHands={Object.fromEntries(session.hands)}
        actingId={acting.id}
        isParent={acting.role === "parent"}
        mains={mains}
        upcomingNights={upcoming.map((d) => ({ date: d, label: formatDay(d) }))}
      />
    </div>
  );
}
