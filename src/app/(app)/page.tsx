import Link from "next/link";
import { Avatar, ButtonLink, Card } from "@/components/ui";
import { greetingKey, say } from "@/lib/copy";
import {
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

export default async function HomePage() {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const [members, ranges] = await Promise.all([getActiveMembers(), loadPresenceRanges(today)]);

  const tone = acting.humorDial;
  const greeting = say(greetingKey(hourIn(settings.timezone)), tone, { name: acting.name }, today.charCodeAt(9));

  const homeTonight = members.filter((m) => presenceOn(m, ranges, today).presence === "home");
  const awayTonight = members.filter((m) => presenceOn(m, ranges, today).presence === "away");
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
            <p className="text-sm font-semibold uppercase tracking-widest text-tomato-strong">
              Tonight
            </p>
            <h2 className="mt-1 text-2xl font-bold">No plan yet</h2>
            <p className="mt-1 text-muted">
              Weekly planning is coming next. For now, pick something from the recipe box.
            </p>
          </div>
          <div>
            <ButtonLink href="/recipes">Browse recipes</ButtonLink>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Home for dinner</h2>
          <ul className="mt-3 space-y-2">
            {homeTonight.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size="sm" />
                <span className="font-semibold">{m.name}</span>
              </li>
            ))}
          </ul>
          {awayTonight.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Away: {awayTonight.map((m) => m.name).join(", ")}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
