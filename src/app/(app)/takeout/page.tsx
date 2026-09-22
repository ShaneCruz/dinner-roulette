import Link from "next/link";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { aiEnabled } from "@/lib/ai/claude";
import { formatDay } from "@/lib/plan/week";
import { lastOrdered, listRestaurants } from "@/lib/restaurants/store";
import { requireActingMember } from "@/lib/session";
import { RestaurantForm } from "./restaurant-form";

export const metadata = { title: "Takeout" };

export default async function TakeoutPage() {
  const { acting } = await requireActingMember();
  const [restaurants, last] = await Promise.all([listRestaurants(db), lastOrdered(db)]);
  const isParent = acting.role === "parent";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Takeout"
        subtitle="No time to cook? Spin for a restaurant and get dish picks for everyone."
        actions={
          restaurants.length >= 2 ? <ButtonLink href="/takeout/spin">🎡 Spin for a place</ButtonLink> : null
        }
      />

      {restaurants.length === 0 ? (
        <Card className="mb-6 text-center">
          <p className="text-4xl" aria-hidden>
            🛵
          </p>
          <p className="mt-2 font-semibold">Add the places you order from.</p>
          <p className="text-sm text-muted">
            {aiEnabled()
              ? "I'll look up each menu and pick a dish for everyone: mild for the mild, spicy for the brave."
              : "Add a few favorites and spin the wheel when nobody can decide."}
          </p>
        </Card>
      ) : (
        <ul className="mb-6 grid gap-3 sm:grid-cols-2">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link href={`/takeout/${r.id}`} className="block h-full transition hover:-translate-y-0.5">
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold">{r.name}</h2>
                      <p className="text-sm text-muted">
                        {r.cuisine}
                        {r.area ? ` · ${r.area}` : ""}
                      </p>
                    </div>
                    {r.research ? (
                      <Badge tone="basil">{r.research.dishes.length} dishes</Badge>
                    ) : r.researchError ? (
                      <Badge tone="tomato">Menu not found</Badge>
                    ) : (
                      <Badge>No menu yet</Badge>
                    )}
                  </div>
                  {r.research?.summary ? <p className="mt-2 line-clamp-2 text-sm">{r.research.summary}</p> : null}
                  {last.get(r.id) ? (
                    <p className="mt-2 text-xs text-muted">Last ordered {formatDay(last.get(r.id)!)}</p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isParent ? (
        <Card>
          <h2 className="mb-3 text-xl font-bold">Add a restaurant</h2>
          <RestaurantForm aiOn={aiEnabled()} />
        </Card>
      ) : null}
    </div>
  );
}
