import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { DeviceReminders } from "@/components/device-reminders";
import { DEFAULT_REMINDERS } from "@/db/schema";
import { vapidPublicKey } from "@/lib/push";
import { ReminderSettings } from "./reminder-settings";
import { AiBudget } from "./ai-budget";
import { weekSpending } from "@/lib/ai/usage";
import { requireParentMember } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { settings, acting } = await requireParentMember();
  const spending = await weekSpending();
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
          timezone: settings.timezone,
          appliances: settings.appliances,
          weeknightActiveMinutes: settings.weeknightActiveMinutes,
          healthyNightsTarget: settings.healthyNightsTarget,
          defaultCooldownDays: settings.defaultCooldownDays,
          chaosSliceEnabled: settings.chaosSliceEnabled,
          weekStartsOn: settings.weekStartsOn,
        }}
        initialGrillCaps={settings.grillCaps}
      />
    </div>
  );
}
