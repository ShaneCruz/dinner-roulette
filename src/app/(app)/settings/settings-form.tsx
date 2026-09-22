"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/member-fields";
import { Button, Card, Field, inputClass } from "@/components/ui";
import type { GrillCaps } from "@/db/schema";
import { APPLIANCES, TIMEZONES, type SettingsInput } from "@/lib/family";
import { updateSettings } from "./actions";

export function SettingsForm({
  initial,
  initialGrillCaps,
}: {
  initial: SettingsInput;
  initialGrillCaps: GrillCaps;
}) {
  const [settings, setSettings] = useState(initial);
  const [grillCaps, setGrillCaps] = useState(initialGrillCaps);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const number = (key: keyof SettingsInput) => ({
    value: settings[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({ ...settings, [key]: Number(e.target.value) }),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await updateSettings(settings, grillCaps);
          setMessage("error" in result ? { ok: false, text: result.error } : { ok: true, text: "Saved." });
        });
      }}
    >
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Family</h2>
        <Field label="Family name">
          <input
            className={inputClass}
            value={settings.familyName}
            onChange={(e) => setSettings({ ...settings, familyName: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home ZIP code">
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={5}
              value={settings.homeZip}
              onChange={(e) => setSettings({ ...settings, homeZip: e.target.value })}
            />
          </Field>
          <Field label="Time zone">
            <select
              className={inputClass}
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            >
              {[...new Set([settings.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("America/", "").replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Planning</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Weeknight hands-on minutes">
            <input className={inputClass} type="number" min={10} max={120} {...number("weeknightActiveMinutes")} />
          </Field>
          <Field label="Healthy dinners per week">
            <input className={inputClass} type="number" min={0} max={7} {...number("healthyNightsTarget")} />
          </Field>
          <Field label="Days before a repeat">
            <input className={inputClass} type="number" min={1} max={60} {...number("defaultCooldownDays")} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Grill nights per week, at most</legend>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["summer", "May – Sep"],
                ["shoulder", "Spring & fall"],
                ["winter", "Dec – Feb"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={7}
                  value={grillCaps[key]}
                  onChange={(e) => setGrillCaps({ ...grillCaps, [key]: Number(e.target.value) })}
                />
              </Field>
            ))}
          </div>
        </fieldset>
        <Field label="The planning week starts on">
          <select
            className={inputClass}
            value={settings.weekStartsOn ?? 0}
            onChange={(e) => setSettings({ ...settings, weekStartsOn: Number(e.target.value) })}
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
            <option value={6}>Saturday</option>
          </select>
        </Field>
        <Toggle
          label="Chaos slice on the wheel (rare surprise results)"
          checked={settings.chaosSliceEnabled}
          onChange={(chaosSliceEnabled) => setSettings({ ...settings, chaosSliceEnabled })}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Kitchen</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {APPLIANCES.map((appliance) => (
            <Toggle
              key={appliance.id}
              label={appliance.label}
              checked={settings.appliances.includes(appliance.id)}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  appliances: checked
                    ? [...settings.appliances, appliance.id]
                    : settings.appliances.filter((a) => a !== appliance.id),
                })
              }
            />
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {message ? (
          <span role="status" className={message.ok ? "text-sm text-basil" : "text-sm text-tomato-strong"}>
            {message.text}
          </span>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
