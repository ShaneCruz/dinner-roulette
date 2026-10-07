import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { DeviceReminders } from "@/components/device-reminders";
import { DEFAULT_REMINDERS } from "@/db/schema";
import { vapidPublicKey } from "@/lib/push";
import { ReminderSettings } from "./reminder-settings";
import { AiBudget } from "./ai-budget";
import { weekSpending } from "@/lib/ai/usage";
import { getActiveMembers, requireParentMember } from "@/lib/session";
import { db } from "@/db";
import { listSportsCalendars, mapsEnabled } from "@/lib/sports/store";
import { SportsCalendars, type CalendarSummary } from "./sports-calendars";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { settings, acting } = await requireParentMember();
  const [spending, calendars, members] = await Promise.all([weekSpending(), listSportsCalendars(db), getActiveMembers()]);
  const now = new Date();
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, month: "short", day: "numeric", year: "numeric" });
  const summaries: CalendarSummary[] = calendars.map((c) => {
    const upcoming = c.events.filter((e) => e.startUtc && new Date(e.startUtc) > now && e.status !== "cancelled");
    const last = c.events.reduce<string | null>((max, e) => {
      const at = e.startUtc ?? e.allDayDate;
      return at && (!max || at > max) ? at : max;
    }, null);
    return {
      id: c.id,
      who: c.who,
      label: c.label,
      events: c.events.length,
      next: upcoming[0] ? `${upcoming[0].title} · ${when.format(new Date(upcoming[0].startUtc!))}` : null,
      lastDate: last ? day.format(new Date(last.length === 10 ? `${last}T12:00:00Z` : last)) : null,
      ended: !upcoming.length,
      error: c.fetchError,
    };
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="How the planner thinks about your week." />
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">📖 How Cruz Meals works</p>
          <p className="text-sm text-muted">The short guide: what each part does and who does what.</p>
        </div>
        <ButtonLink href="/help" variant="secondary" size="sm">
          Open the guide
        </ButtonLink>
      </Card>
      <AiBudget budgetCents={spending.budgetCents} spentCents={spending.spentCents} byFeature={spending.byFeature} />
      <Card className="space-y-2">
        <h2 className="text-xl font-bold">📱 Reminders on this phone</h2>
        <DeviceReminders vapidKey={vapidPublicKey()} name={acting.name} />
      </Card>
      <ReminderSettings
        initial={{
          dinnerTime: settings.dinnerTime,
          autopilotEnabled: settings.autopilotEnabled,
          autopilotDay: settings.autopilotDay,
          reminders: { ...DEFAULT_REMINDERS, ...settings.reminders },
        }}
      />
      <SettingsForm
        initial={{
          familyName: settings.familyName,
          homeZip: settings.homeZip ?? "",
          homeAddress: settings.homeAddress ?? "",
          timezone: settings.timezone,
          appliances: settings.appliances,
          weeknightActiveMinutes: settings.weeknightActiveMinutes,
          healthyNightsTarget: settings.healthyNightsTarget,
          defaultCooldownDays: settings.defaultCooldownDays,
          chaosSliceEnabled: settings.chaosSliceEnabled,
          weekStartsOn: settings.weekStartsOn,
          usualServings: settings.usualServings,
          cookNightsPerWeek: settings.cookNightsPerWeek,
        }}
        initialGrillCaps={settings.grillCaps}
      />
      <SportsCalendars
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        calendars={summaries}
        driveTimes={!mapsEnabled() ? "no-key" : settings.homeAddress ? "on" : "no-address"}
      />
    </div>
  );
}
