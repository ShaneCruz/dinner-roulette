import Link from "next/link";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { grocerySnapshot } from "@/lib/grocery/store";
import { findWeekPlan } from "@/lib/plan/store";
import { formatDay, weekDates, weekStartFor } from "@/lib/plan/week";
import { addDays, todayIn } from "@/lib/presence";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { GroceryList } from "./grocery-list";
import { Tip } from "@/components/tip";

export const metadata = { title: "Grocery list" };

export default async function GroceryPage({ searchParams }: PageProps<"/grocery">) {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const requested = (await searchParams).week;
  const anchor = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const weekStart = weekStartFor(anchor, settings.weekStartsOn);
  const dates = weekDates(weekStart);
  const [plan, members] = await Promise.all([findWeekPlan(db, weekStart), getActiveMembers()]);
  const snapshot = plan ? await grocerySnapshot(db, plan.id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Grocery list"
        subtitle={`${formatDay(dates[0])} – ${formatDay(dates[6])}`}
        actions={
          plan ? (
            <ButtonLink href={`/grocery/print?week=${weekStart}`} variant="secondary" size="sm">
              🖨️ Print
            </ButtonLink>
          ) : null
        }
      />
      <nav className="no-print mb-4 flex justify-between text-sm font-semibold" aria-label="Weeks">
        <Link href={`/grocery?week=${addDays(weekStart, -7)}`} className="rounded-full px-3 py-1.5 hover:bg-surface-muted">
          ← Last week
        </Link>
        <Link href={`/grocery?week=${addDays(weekStart, 7)}`} className="rounded-full px-3 py-1.5 hover:bg-surface-muted">
          Next week →
        </Link>
      </nav>
      <Tip id="grocery">
        This list comes from the week&apos;s dinners. Check things off as you shop, even with no signal, and tap a section
        header to claim it when you&apos;re splitting up.
      </Tip>
      {plan && snapshot ? (
        <GroceryList
          weekPlanId={plan.id}
          initial={snapshot}
          actingId={acting.id}
          members={members.map((m) => ({ id: m.id, name: m.name, emoji: m.avatarEmoji, color: m.avatarColor }))}
        />
      ) : (
        <Card className="py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🛒
          </p>
          <p className="mt-2 font-semibold">No dinners planned for this week yet.</p>
          <p className="text-sm text-muted">The list builds itself as you plan.</p>
          <ButtonLink href={`/plan?week=${weekStart}`} className="mt-4">
            Plan the week
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
