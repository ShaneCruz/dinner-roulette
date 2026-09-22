import Link from "next/link";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { formatDay } from "@/lib/plan/week";
import { daysBetween, todayIn } from "@/lib/presence";
import { withNames } from "@/lib/restaurants/names";
import { lastOrdered, listRestaurants } from "@/lib/restaurants/store";
import { restaurantWeight, usualOrder } from "@/lib/restaurants/favorites";
import { eatersFor, loadEaterContext, loadMeals } from "@/lib/plan/store";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { TakeoutSpinner } from "./takeout-spinner";

export const metadata = { title: "Spin for takeout" };

export default async function SpinPage({ searchParams }: PageProps<"/takeout/spin">) {
  const { settings, acting } = await requireActingMember();
  const params = await searchParams;
  const today = todayIn(settings.timezone);
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const [restaurants, members, last] = await Promise.all([listRestaurants(db), getActiveMembers(), lastOrdered(db)]);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const [eaterContext, meals] = await Promise.all([loadEaterContext(db, date, date), loadMeals(db, date, date)]);
  const eaters = eatersFor(eaterContext, date, meals.get(date)?.eaterIds);
  const eaterIds = eaters.map((m) => m.id);

  if (restaurants.length < 2) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Spin for takeout" />
        <Card className="text-center">
          <p>Add at least two restaurants to spin between.</p>
          <ButtonLink href="/takeout" className="mt-4">
            Add restaurants
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/takeout" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Takeout
      </Link>
      <PageHeader
        title="Where are we ordering from?"
        subtitle={date === today ? "Tonight" : formatDay(date, "long")}
      />
      <TakeoutSpinner
        date={date}
        canSave={acting.role === "parent"}
        restaurants={restaurants.map((r) => {
          const lastDate = last.get(r.id);
          return {
            id: r.id,
            name: r.name,
            cuisine: r.cuisine,
            recentDays: lastDate ? daysBetween(lastDate, today) : null,
            picks: r.research?.picks ?? [],
            familyOrder: withNames(r.research?.familyOrder ?? null, r.research?.labels, names),
            weight: restaurantWeight(r.favorites, eaterIds),
            meh: eaters.filter((m) => r.favorites?.people[m.id]?.feeling === "meh").map((m) => m.name),
            loves: eaters.filter((m) => r.favorites?.people[m.id]?.feeling === "love").map((m) => m.name),
            usual: r.favorites ? usualOrder(r.favorites, eaters.map((m) => ({ id: m.id, name: m.name }))) : null,
          };
        })}
        members={members.map((m) => ({ id: m.id, name: m.name, emoji: m.avatarEmoji, color: m.avatarColor }))}
        preselected={typeof params.pick === "string" ? params.pick : null}
      />
    </div>
  );
}
