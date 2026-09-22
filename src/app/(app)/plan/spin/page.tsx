import Link from "next/link";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { loadHands } from "@/lib/fun/cards";
import { cuisineEmoji } from "@/lib/cuisine-emoji";
import { loadMeals } from "@/lib/plan/store";
import { formatDay, weekStartFor } from "@/lib/plan/week";
import { addDays, todayIn } from "@/lib/presence";
import { requireActingMember } from "@/lib/session";
import { rankForNight, seededRandom } from "@/lib/suggest/engine";
import { seedFrom } from "@/lib/fun/deck";
import { dealWheel } from "@/lib/fun/wheel-options";
import { loadEngineInputs } from "@/lib/suggest/load";
import { DinnerSpinner } from "./dinner-spinner";

export const metadata = { title: "Spin for dinner" };

const SLICES = 6;

export default async function DinnerSpinPage({ searchParams }: PageProps<"/plan/spin">) {
  const { settings, acting } = await requireActingMember();
  const params = await searchParams;
  const today = todayIn(settings.timezone);
  const requested = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const date = requested < today || requested > addDays(today, 14) ? today : requested;
  const weekStart = weekStartFor(date, settings.weekStartsOn);
  const [inputs, hands] = await Promise.all([loadEngineInputs(db, weekStart), loadHands(db, weekStart)]);
  const night = inputs.nights.find((n) => n.date === date)!;
  const isParent = acting.role === "parent";

  const back = (
    <Link href="/plan" className="text-sm font-semibold text-muted hover:text-foreground">
      ← Plan
    </Link>
  );
  const reason = (await loadMeals(db, date, date)).get(date)?.suggestionReason ?? null;

  if (night.nightType !== "cook" || night.status === "cooked") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {back}
        <PageHeader title="Spin for dinner" subtitle={formatDay(date, "long")} />
        <Card className="text-center">
          <p>{night.status === "cooked" ? "That dinner's already made. Nice." : "That night isn't a cooking night."}</p>
          {night.nightType === "takeout" ? (
            <ButtonLink href={`/takeout/spin?date=${date}`} className="mt-3">
              🎡 Spin for takeout instead
            </ButtonLink>
          ) : null}
        </Card>
      </div>
    );
  }

  const handPicked = Boolean(night.recipeId) && (!reason || reason.startsWith("👨‍🍳"));
  const alreadySpun = Boolean(reason?.startsWith("🎡") || reason?.startsWith("🎲"));

  const ranked = rankForNight(
    night,
    inputs.context,
    inputs.chosen.filter((c) => c.date !== date),
  ).filter((r) => !r.excluded);
  const byId = new Map(inputs.context.recipes.map((r) => [r.id, r]));
  const deal = typeof params.deal === "string" && /^\d{1,6}$/.test(params.deal) ? Number(params.deal) : 0;
  const dealt = dealWheel(
    ranked,
    new Map(inputs.context.recipes.map((r) => [r.id, r.lastCooked])),
    today,
    seededRandom(seedFrom(`${date}:${deal}`)),
    { size: SLICES },
  );
  const reasons = new Map(ranked.map((r) => [r.recipeId, r.reasons[0] ?? null]));
  const options = dealt.map((id) => {
    const found = byId.get(id)!;
    return {
      id: found.id,
      title: found.title,
      slug: found.slug,
      emoji: cuisineEmoji(`${found.title} ${found.cuisine}`),
      reason: found.lastCooked ? reasons.get(id) ?? null : `Never made it! ${reasons.get(id) ?? ""}`.trim(),
    };
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {back}
      <PageHeader
        title="Spin for dinner"
        subtitle={`${date === today ? "Tonight" : formatDay(date, "long")} · ${options.length} good fits for whoever's eating`}
      />
      {handPicked && !isParent ? (
        <Card className="text-center">
          <p>Someone already picked this dinner on purpose. Ask a parent if you want to change it.</p>
        </Card>
      ) : options.length < 2 ? (
        <Card className="text-center">
          <p>Not enough dinners fit this night to spin. Try giving it more time on the plan.</p>
        </Card>
      ) : (
        <DinnerSpinner
          key={`${date}:${deal}`}
          shuffleHref={ranked.length > SLICES ? `/plan/spin?date=${date}&deal=${deal + 1}` : null}
          date={date}
          options={options}
          chaosEnabled={settings.chaosSliceEnabled}
          spinnerName={acting.name}
          tone={acting.humorDial}
          isParent={isParent}
          alreadySpun={alreadySpun}
          respins={isParent ? 0 : (hands.get(acting.id)?.powerUps.respin ?? 0)}
          current={night.recipeId ? (byId.get(night.recipeId)?.title ?? null) : null}
          handPicked={handPicked}
        />
      )}
    </div>
  );
}
