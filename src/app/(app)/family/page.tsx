import { eq } from "drizzle-orm";
import Link from "next/link";
import { Avatar, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { memberFoodRule, recipe } from "@/db/schema";
import { SPICE_LABELS } from "@/lib/family";
import { formatDateRange, presenceOn, todayIn } from "@/lib/presence";
import { loadPresenceRanges } from "@/lib/presence-data";
import { getActiveMembers, requireActingMember } from "@/lib/session";

export const metadata = { title: "Family" };

export default async function FamilyPage() {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const [members, ranges, rules] = await Promise.all([
    getActiveMembers(),
    loadPresenceRanges(today),
    db
      .select({
        memberId: memberFoodRule.memberId,
        kind: memberFoodRule.kind,
        ingredient: memberFoodRule.ingredient,
        recipeTitle: recipe.title,
      })
      .from(memberFoodRule)
      .leftJoin(recipe, eq(recipe.id, memberFoodRule.recipeId)),
  ]);
  const isParent = acting.role === "parent";

  return (
    <div>
      <PageHeader
        title="The crew"
        subtitle="Who eats here, what they love, and what they'd rather feed the dog."
        actions={isParent ? <ButtonLink href="/family/new">+ Add person</ButtonLink> : null}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {members.map((m) => {
          const today_ = presenceOn(m, ranges, today);
          const nextRange = ranges.find((r) => r.memberId === m.id && r.endDate >= today);
          const loves = rules.filter((r) => r.memberId === m.id && r.kind === "love");
          const nopes = rules.filter((r) => r.memberId === m.id && r.kind === "nope");
          const canOpen = isParent || m.id === acting.id;
          const body = (
            <Card className="h-full">
              <div className="flex items-center gap-4">
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold">{m.name}</h2>
                  {m.chefTitle ? <p className="text-sm text-muted">{m.chefTitle}</p> : null}
                </div>
                <Badge tone={today_.presence === "home" ? "basil" : "neutral"}>
                  {today_.presence === "home" ? "Home" : "Away"}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="text-muted">Spice:</span> {SPICE_LABELS[m.spiceTolerance]}
                </p>
                {loves.length > 0 ? (
                  <p>
                    <span className="text-muted">Loves:</span>{" "}
                    {loves.map((l) => l.recipeTitle ?? l.ingredient).join(", ")}
                  </p>
                ) : null}
                {nopes.length > 0 ? (
                  <p>
                    <span className="text-muted">Won&apos;t eat:</span>{" "}
                    {nopes.map((n) => n.ingredient ?? n.recipeTitle).join(", ")}
                  </p>
                ) : null}
                {nextRange ? (
                  <p>
                    <span className="text-muted">
                      {nextRange.presence === "home" ? "Home" : "Away"}:
                    </span>{" "}
                    {nextRange.label}, {formatDateRange(nextRange.startDate, nextRange.endDate)}
                    {nextRange.tentative ? " (unconfirmed)" : ""}
                  </p>
                ) : null}
              </div>
            </Card>
          );
          return (
            <li key={m.id}>
              {canOpen ? (
                <Link href={`/family/${m.id}`} className="block h-full transition hover:-translate-y-0.5">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
