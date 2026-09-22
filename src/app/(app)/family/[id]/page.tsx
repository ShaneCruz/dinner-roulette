import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { member, memberAvailability, memberFoodRule, recipe } from "@/db/schema";
import { todayIn } from "@/lib/presence";
import { faceFor } from "@/lib/ratings/scale";
import { ratingsByMember } from "@/lib/ratings/store";
import { Card } from "@/components/ui";
import { requireActingMember } from "@/lib/session";
import { loadBadgeStats } from "@/lib/fun/badges";
import { TrophyShelf } from "@/components/trophy-shelf";
import { DeviceReminders } from "@/components/device-reminders";
import { vapidPublicKey } from "@/lib/push";
import {
  AvailabilityEditor,
  FoodRulesEditor,
  MemberEditor,
  OwnLookEditor,
  PinEditor,
} from "../member-editors";
import { CalendarImport } from "./calendar-import";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata = { title: "Family member" };

export default async function MemberPage({ params }: PageProps<"/family/[id]">) {
  const { settings, acting } = await requireActingMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [found] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, id), isNull(member.archivedAt)))
    .limit(1);
  if (!found) notFound();

  const isParent = acting.role === "parent";
  const isSelf = acting.id === found.id;
  if (!isParent && !isSelf) redirect("/family");

  const taste = await tasteProfile(found.id);
  const stats = (await loadBadgeStats(db, [found.id], todayIn(settings.timezone), settings.weekStartsOn)).get(found.id)!;
  const trophies = <TrophyShelf stats={stats} name={found.name} />;

  const back = (
    <Link href="/family" className="text-sm font-semibold text-muted hover:text-foreground">
      ← Family
    </Link>
  );

  if (!isParent) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {back}
        <PageHeader title="Your look" subtitle="Pick an avatar and a chef title. Go wild." />
        {trophies}
        <Card className="space-y-2">
          <h2 className="text-xl font-bold">📱 Reminders</h2>
          <p className="text-sm text-muted">Get a nudge on this phone to rate dinner.</p>
          <DeviceReminders vapidKey={vapidPublicKey()} name={found.name} />
        </Card>
        {taste}
        <OwnLookEditor
          initial={{ avatarEmoji: found.avatarEmoji, avatarColor: found.avatarColor, chefTitle: found.chefTitle }}
        />
        <PinEditor memberId={found.id} hasPin={Boolean(found.pinHash)} />
      </div>
    );
  }

  const [rules, ranges, recipes] = await Promise.all([
    db
      .select({
        id: memberFoodRule.id,
        kind: memberFoodRule.kind,
        ingredient: memberFoodRule.ingredient,
        note: memberFoodRule.note,
        recipeTitle: recipe.title,
      })
      .from(memberFoodRule)
      .leftJoin(recipe, eq(recipe.id, memberFoodRule.recipeId))
      .where(eq(memberFoodRule.memberId, found.id))
      .orderBy(asc(memberFoodRule.createdAt)),
    db
      .select()
      .from(memberAvailability)
      .where(eq(memberAvailability.memberId, found.id))
      .orderBy(asc(memberAvailability.startDate)),
    db
      .select({ id: recipe.id, title: recipe.title })
      .from(recipe)
      .where(and(isNull(recipe.archivedAt), eq(recipe.kind, "main")))
      .orderBy(asc(recipe.title)),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {back}
      <PageHeader title={found.name} subtitle={found.chefTitle ?? undefined} />
      <MemberEditor
        id={found.id}
        canArchive={!isSelf}
        initial={{
          name: found.name,
          role: found.role,
          birthYear: found.birthYear,
          avatarEmoji: found.avatarEmoji,
          avatarColor: found.avatarColor,
          chefTitle: found.chefTitle,
          humorDial: found.humorDial,
          spiceTolerance: found.spiceTolerance,
          prefersHighProtein: found.prefersHighProtein,
          wantsHealthySwaps: found.wantsHealthySwaps,
          defaultPresence: found.defaultPresence,
          authEmail: found.authEmail ?? "",
        }}
      />
      {taste}
      {trophies}
      <FoodRulesEditor memberId={found.id} name={found.name} rules={rules} recipes={recipes} />
      {aiEnabled() ? (
        <CalendarImport memberId={found.id} name={found.name} boarding={found.defaultPresence === "away"} />
      ) : null}
      <AvailabilityEditor
        memberId={found.id}
        name={found.name}
        defaultPresence={found.defaultPresence}
        today={todayIn(settings.timezone)}
        ranges={ranges.map((r) => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          presence: r.presence,
          label: r.label,
          tentative: r.tentative,
          note: r.note,
        }))}
      />
      <PinEditor memberId={found.id} hasPin={Boolean(found.pinHash)} />
    </div>
  );
}

/** Favorites and flops, learned from this person's ratings. */
async function tasteProfile(memberId: string) {
  const rows = await ratingsByMember(db, memberId);
  if (!rows.length) return null;
  const byRecipe = new Map<string, { title: string; slug: string; stars: number[] }>();
  for (const r of rows) {
    const entry = byRecipe.get(r.recipeId) ?? { title: r.title, slug: r.slug, stars: [] };
    entry.stars.push(r.stars);
    byRecipe.set(r.recipeId, entry);
  }
  const averaged = [...byRecipe.values()].map((r) => ({ ...r, avg: r.stars.reduce((a, b) => a + b, 0) / r.stars.length }));
  const favorites = averaged.filter((r) => r.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 8);
  const flops = averaged.filter((r) => r.avg <= 2).sort((a, b) => a.avg - b.avg).slice(0, 8);
  const list = (items: typeof averaged) => (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((r) => (
        <li key={r.slug}>
          <Link href={`/recipes/${r.slug}`} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold">
            {faceFor(r.avg).emoji} {r.title}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <Card>
      <h2 className="text-xl font-bold">What the ratings say</h2>
      <p className="text-sm text-muted">{rows.length} dinners rated so far.</p>
      {favorites.length ? (
        <div className="mt-3">
          <p className="text-sm font-semibold">Favorites</p>
          {list(favorites)}
        </div>
      ) : null}
      {flops.length ? (
        <div className="mt-3">
          <p className="text-sm font-semibold">Not a fan</p>
          {list(flops)}
        </div>
      ) : null}
    </Card>
  );
}
