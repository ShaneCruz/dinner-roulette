import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { member, memberAvailability, memberFoodRule, recipe } from "@/db/schema";
import { todayIn } from "@/lib/presence";
import { requireActingMember } from "@/lib/session";
import {
  AvailabilityEditor,
  FoodRulesEditor,
  MemberEditor,
  OwnLookEditor,
  PinEditor,
} from "../member-editors";

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
      <FoodRulesEditor memberId={found.id} name={found.name} rules={rules} recipes={recipes} />
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
