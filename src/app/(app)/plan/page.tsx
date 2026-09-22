import Link from "next/link";
import { ButtonLink, PageHeader } from "@/components/ui";
import { weekStartFor, weekDates, formatDay } from "@/lib/plan/week";
import { loadWeekView } from "@/lib/plan/view";
import { addDays, todayIn } from "@/lib/presence";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { PlanBoard } from "./plan-board";

export const metadata = { title: "This week" };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const requested = (await searchParams).week;
  const anchor = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const weekStart = weekStartFor(anchor, settings.weekStartsOn);
  const dates = weekDates(weekStart);

  const [view, members] = await Promise.all([loadWeekView(weekStart), getActiveMembers()]);
  const isCurrent = dates.includes(today);
  const planned = view.nights.filter((n) => n.status !== "empty").length;

  return (
    <div>
      <PageHeader
        title={isCurrent ? "This week" : `Week of ${formatDay(weekStart)}`}
        subtitle={`${formatDay(dates[0])} – ${formatDay(dates[6])} · ${planned} of 7 nights planned`}
        actions={
          <>
            <ButtonLink href={`/grocery?week=${weekStart}`} variant="secondary" size="sm">
              🛒 Grocery list
            </ButtonLink>
            <ButtonLink href={`/plan/print?week=${weekStart}`} variant="secondary" size="sm">
              🖨️ Print
            </ButtonLink>
          </>
        }
      />
      <nav className="mb-5 flex items-center justify-between text-sm font-semibold" aria-label="Weeks">
        <Link href={`/plan?week=${addDays(weekStart, -7)}`} className="rounded-full px-3 py-1.5 hover:bg-surface-muted">
          ← Last week
        </Link>
        {!isCurrent ? (
          <Link href="/plan" className="rounded-full px-3 py-1.5 text-tomato hover:bg-tomato-soft">
            Back to this week
          </Link>
        ) : null}
        <Link href={`/plan?week=${addDays(weekStart, 7)}`} className="rounded-full px-3 py-1.5 hover:bg-surface-muted">
          Next week →
        </Link>
      </nav>
      <PlanBoard
        nights={view.nights}
        options={view.options}
        bumped={view.bumped}
        today={today}
        canEdit={acting.role === "parent"}
        weeknightActiveMinutes={settings.weeknightActiveMinutes}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          emoji: m.avatarEmoji,
          color: m.avatarColor,
        }))}
      />
    </div>
  );
}
