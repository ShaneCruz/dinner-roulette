import { PageHeader } from "@/components/ui";
import { requireParentMember } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { settings } = await requireParentMember();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="How the planner thinks about your week." />
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
        }}
        initialGrillCaps={settings.grillCaps}
      />
    </div>
  );
}
