import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { aiEnabled } from "@/lib/ai/claude";
import { withNames } from "@/lib/restaurants/names";
import { getRestaurant } from "@/lib/restaurants/store";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { RestaurantTools } from "./restaurant-tools";

export async function generateMetadata({ params }: PageProps<"/takeout/[id]">) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getRestaurant(db, id) : null;
  return { title: found?.name ?? "Restaurant" };
}

const TAG_LABELS: Record<string, string> = {
  mild: "Mild",
  spicy: "🌶️ Spicy",
  kid_friendly: "Kid friendly",
  high_protein: "High protein",
  lighter: "Lighter",
  vegetarian: "Vegetarian",
  contains_beef: "Beef",
  shareable: "Shareable",
};

export default async function RestaurantPage({ params, searchParams }: PageProps<"/takeout/[id]">) {
  const { acting } = await requireActingMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [place, members] = await Promise.all([getRestaurant(db, id), getActiveMembers()]);
  if (!place || place.archivedAt) notFound();
  const research = place.research;
  const isParent = acting.role === "parent";
  const startResearch = (await searchParams).research === "1" && !research;
  const names = new Map(members.map((m) => [m.id, m.name]));
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

          <Card>
            <h2 className="text-xl font-bold">Menu highlights</h2>
            <ul className="mt-3 divide-y divide-border">
              {research.dishes.map((dish) => (
                <li key={dish.name} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{dish.name}</span>
                    {dish.price ? <span className="shrink-0 text-sm text-muted">{dish.price}</span> : null}
                  </div>
                  {dish.description ? <p className="text-sm text-muted">{dish.description}</p> : null}
                  {dish.tags.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dish.tags.map((tag) => (
                        <Badge key={tag} tone={tag === "spicy" ? "tomato" : tag === "mild" || tag === "kid_friendly" ? "basil" : "neutral"}>
                          {TAG_LABELS[tag] ?? tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
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
