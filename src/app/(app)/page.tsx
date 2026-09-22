import { eq } from "drizzle-orm";
import Link from "next/link";
import { Avatar, ButtonLink, Card } from "@/components/ui";
import { db } from "@/db";
import { recipe } from "@/db/schema";
import { loadMeals, recipeTitles } from "@/lib/plan/store";
import { NIGHT_TYPES } from "@/lib/plan/week";
import { greetingKey, say } from "@/lib/copy";
import {
  addDays,
  formatDateRange,
  hourIn,
  presenceOn,
  rangesNeedingConfirmation,
  todayIn,
  upcomingExceptions,
  upcomingHomecomings,
} from "@/lib/presence";
import { loadPresenceRanges } from "@/lib/presence-data";
import { getActiveMembers, requireActingMember } from "@/lib/session";
import { MadeItButton } from "./tonight-actions";

export default async function HomePage() {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const [members, ranges] = await Promise.all([getActiveMembers(), loadPresenceRanges(today)]);

  const tone = acting.humorDial;
  const greeting = say(greetingKey(hourIn(settings.timezone)), tone, { name: acting.name }, today.charCodeAt(9));

  const tomorrow = addDays(today, 1);
  const meals = await loadMeals(db, today, tomorrow);
  const tonight = meals.get(today) ?? null;
  const tomorrowMeal = meals.get(tomorrow) ?? null;
  const titles = await recipeTitles(
    db,
    [tonight, tomorrowMeal].flatMap((m) => (m?.recipeId ? [m.recipeId, ...m.sideRecipeIds] : [])),
  );
  const [tonightFull] = tonight?.recipeId ? await db.select().from(recipe).where(eq(recipe.id, tonight.recipeId)) : [];
  const tonightRecipe = tonight?.nightType === "cook" && tonightFull ? tonightFull : null;
  const tonightSides = (tonight?.sideRecipeIds ?? []).map((id) => titles.get(id)?.title).filter(Boolean);
  const tomorrowLabel = !tomorrowMeal
    ? null
    : tomorrowMeal.nightType !== "cook"
      ? NIGHT_TYPES[tomorrowMeal.nightType].label
      : tomorrowMeal.recipeId
        ? titles.get(tomorrowMeal.recipeId)?.title ?? null
        : null;

  const homeIds = new Set(
    tonight?.eaterIds ?? members.filter((m) => presenceOn(m, ranges, today).presence === "home").map((m) => m.id),
  );
  const eatingTonight = members.filter((m) => homeIds.has(m.id));
  const notEatingTonight = members.filter((m) => !homeIds.has(m.id));
  const homecomings = upcomingHomecomings(members, ranges, today);
  const toConfirm = acting.role === "parent" ? rangesNeedingConfirmation(ranges, today) : [];
  const exceptions = upcomingExceptions(members, ranges, today);
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">
          {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
            timeZone: "UTC",
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{greeting}</h1>
      </div>

      {homecomings.map(({ member, daysUntil, range }) => (
        <Card key={range.id} className="border-mustard bg-mustard-soft">
          <div className="flex items-center gap-4">
            <Avatar emoji={member.avatarEmoji} color={member.avatarColor} size="lg" className="animate-bounce" />
            <div>
              <p className="text-xl font-bold">
                {daysUntil === 0
                  ? say("homeToday", tone, { name: member.name })
                  : say("comingHome", tone, {
                      name: member.name,
                      days: daysUntil === 1 ? "1 day" : `${daysUntil} days`,
                    })}
              </p>
              <p className="text-sm text-muted">
                {range.label} · home for dinner {formatDateRange(range.startDate, range.endDate)}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {toConfirm.length > 0 ? (
        <Card className="border-tomato/40 bg-tomato-soft">
          <p className="font-bold text-tomato-strong">Please confirm these plans</p>
          <ul className="mt-2 space-y-1 text-sm">
            {toConfirm.map((r) => (
              <li key={r.id}>
                <Link href={`/family/${r.memberId}#availability`} className="underline">
                  {memberName(r.memberId)}: {r.label} ({formatDateRange(r.startDate, r.endDate)})
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {exceptions.length > 0 ? (
        <Card>
          <p className="font-bold">Heads up</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {exceptions.map(({ member, range }) => (
              <li key={range.id}>
                <span className="font-semibold text-foreground">{member.name}</span> is away{" "}
                {formatDateRange(range.startDate, range.endDate)} ({range.label})
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card className="flex flex-col justify-between gap-4 bg-gradient-to-br from-tomato-soft to-surface p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-tomato-strong">Tonight</p>
            {tonight && tonight.nightType !== "cook" ? (
              <h2 className="mt-1 text-3xl font-bold">
                {NIGHT_TYPES[tonight.nightType].emoji} {NIGHT_TYPES[tonight.nightType].label}
              </h2>
            ) : tonightRecipe ? (
              <>
                <h2 className="mt-1 text-3xl font-bold">{tonightRecipe.title}</h2>
                {tonightSides.length > 0 ? (
                  <p className="text-muted">with {tonightSides.join(" + ")}</p>
                ) : null}
                <p className="mt-2 text-sm text-muted">
                  {tonight?.status === "cooked"
                    ? "✓ Made it. Nice work, chef."
                    : `${tonightRecipe.activeMinutes} min hands-on${
                        tonightRecipe.totalMinutes - tonightRecipe.activeMinutes >= 60
                          ? ` · needs about ${Math.round(tonightRecipe.totalMinutes / 60)} hours total, so start early`
                          : ""
                      }`}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-bold">No plan yet</h2>
                <p className="mt-1 text-muted">Pick something for tonight, or plan the whole week in one go.</p>
              </>
            )}
            {tonight?.status === "skipped" ? <p className="mt-1 text-sm text-muted">(Skipped)</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {tonightRecipe ? (
              <ButtonLink href={`/recipes/${tonightRecipe.slug}`}>Let&apos;s cook</ButtonLink>
            ) : (
              <ButtonLink href="/plan">Plan the week</ButtonLink>
            )}
            {tonightRecipe && tonight?.status === "planned" && acting.role === "parent" ? (
              <MadeItButton date={today} />
            ) : null}
            {tonightRecipe ? (
              <ButtonLink href="/plan" variant="ghost">
                Change it
              </ButtonLink>
            ) : null}
          </div>
          {tomorrowLabel ? <p className="text-sm text-muted">Tomorrow: {tomorrowLabel}</p> : null}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Eating tonight</h2>
          <ul className="mt-3 space-y-2">
            {eatingTonight.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size="sm" />
                <span className="font-semibold">{m.name}</span>
              </li>
            ))}
          </ul>
          {notEatingTonight.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Not eating: {notEatingTonight.map((m) => m.name).join(", ")}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
