import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { aiEnabled } from "@/lib/ai/claude";
import { sameDish } from "@/lib/restaurants/favorites";
import { withNames } from "@/lib/restaurants/names";
import { getRestaurant, isResearchRunning, usualDishes } from "@/lib/restaurants/store";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { eatersFor, loadEaterContext, loadMeals } from "@/lib/plan/store";
import { todayIn } from "@/lib/presence";
import { RestaurantTools } from "./restaurant-tools";
import { UsualOrder } from "./usual-order";
import { MenuChat } from "./menu-chat";
import { MenuList } from "./menu-list";

export async function generateMetadata({ params }: PageProps<"/takeout/[id]">) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getRestaurant(db, id) : null;
  return { title: found?.name ?? "Restaurant" };
}


export default async function RestaurantPage({ params, searchParams }: PageProps<"/takeout/[id]">) {
  const { acting, settings } = await requireActingMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [place, members] = await Promise.all([getRestaurant(db, id), getActiveMembers()]);
  if (!place || place.archivedAt) notFound();
  const research = place.research;
  const running = isResearchRunning(place);
  const ourDishes = usualDishes(place.favorites);
  const isUsual = (name: string) => ourDishes.some((ours) => sameDish(ours, name));
  const isParent = acting.role === "parent";
  const startResearch = (await searchParams).research === "1" && !research;
  const names = new Map(members.map((m) => [m.id, m.name]));
  const today = todayIn(settings.timezone);
  const [eaterContext, meals] = await Promise.all([loadEaterContext(db, today, today), loadMeals(db, today, today)]);
  const eatingTonight = eatersFor(eaterContext, today, meals.get(today)?.eaterIds).map((m) => m.id);
  const named = (text: string | null) => withNames(text, research?.labels, names);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/takeout" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Takeout
      </Link>
      <PageHeader
        title={place.name}
        subtitle={[place.cuisine, place.area, research?.priceRange].filter(Boolean).join(" · ")}
        actions={<ButtonLink href={`/takeout/spin?pick=${place.id}`} variant="secondary" size="sm">🎡 Spin</ButtonLink>}
      />

      {isParent ? (
        <RestaurantTools
          id={place.id}
          hasResearch={Boolean(research)}
          researchError={place.researchError}
          researchRunning={running}
          autoStart={startResearch}
          aiOn={aiEnabled()}
          values={{
            name: place.name,
            cuisine: place.cuisine,
            area: place.area ?? "",
            website: place.website ?? "",
            phone: place.phone ?? "",
            notes: place.notes ?? "",
          }}
        />
      ) : null}

      <UsualOrder
        restaurantId={place.id}
        restaurantName={place.name}
        phone={place.phone}
        people={members.map((m) => ({
          id: m.id,
          name: m.name,
          emoji: m.avatarEmoji,
          color: m.avatarColor,
          role: m.role,
          traits: {
            isKid: m.role === "kid",
            spiceTolerance: m.spiceTolerance,
            prefersHighProtein: m.prefersHighProtein,
            wantsHealthy: m.wantsHealthySwaps,
          },
        }))}
        favorites={place.favorites}
        research={research ? { dishes: research.dishes, picks: research.picks } : null}
        actingId={acting.id}
        isParent={isParent}
        eatingIds={eatingTonight}
      />

      {research ? (
        <>
          <Card>
            <p>{named(research.summary)}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {research.menuUrl ? (
                <a href={research.menuUrl} target="_blank" rel="noreferrer" className="font-semibold text-tomato underline">
                  Full menu
                </a>
              ) : null}
              {place.website ? (
                <a href={place.website} target="_blank" rel="noreferrer" className="font-semibold text-tomato underline">
                  Website
                </a>
              ) : null}
              {place.phone ? (
                <a href={`tel:${place.phone}`} className="font-semibold text-tomato underline">
                  📞 {place.phone}
                </a>
              ) : null}
            </div>
            {research.orderingTips ? <p className="mt-3 text-sm text-muted">{research.orderingTips}</p> : null}
            {place.notes ? <p className="mt-2 text-sm">📝 {place.notes}</p> : null}
          </Card>

          <Card>
            <h2 className="text-xl font-bold">What everyone should get</h2>
            <ul className="mt-3 space-y-3">
              {members.map((m) => {
                const pick = research.picks.find((p) => p.memberId === m.id);
                if (!pick) return null;
                return (
                  <li key={m.id} className="flex gap-3">
                    <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size="sm" />
                    <div>
                      <p>
                        <span className="font-bold">{m.name}:</span> {pick.dish}
                      </p>
                      <p className="text-sm text-muted">{named(pick.why)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {research.familyOrder ? (
              <p className="mt-4 rounded-2xl bg-basil-soft px-4 py-3 text-sm">
                <span className="font-semibold">For the table:</span> {named(research.familyOrder)}
              </p>
            ) : null}
          </Card>

          <MenuChat restaurantId={place.id} restaurantName={place.name} />

          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">The menu</h2>
              {research.menuFrom === "family" ? (
                <span className="text-sm font-semibold text-basil">✓ From their menu</span>
              ) : (
                <span className="text-sm text-muted" title="A search can't see menus kept in ordering apps">
                  ~ Found by searching
                </span>
              )}
            </div>
            {ourDishes.length ? <p className="text-sm text-muted">⭐ marks what you usually order.</p> : null}
            <MenuList dishes={research.dishes} usuals={research.dishes.filter((d) => isUsual(d.name)).map((d) => d.name)} />
            {research.sources.length ? (
              <p className="mt-4 text-xs text-muted">
                Sources:{" "}
                {research.sources.map((s, i) => (
                  <span key={s.url}>
                    {i ? ", " : ""}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.title || new URL(s.url).hostname}
                    </a>
                  </span>
                ))}
                . Menus change; double-check prices when you order.
              </p>
            ) : null}
          </Card>
        </>
      ) : !isParent ? (
        <Card className="text-sm text-muted">No menu yet. Ask a parent to look it up.</Card>
      ) : null}
    </div>
  );
}
