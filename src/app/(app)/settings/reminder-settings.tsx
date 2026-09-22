"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/member-fields";
import { Button, Card, Field, inputClass } from "@/components/ui";
import type { ReminderPrefs } from "@/db/schema";
import { updateReminderSettings } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ReminderSettings({
  initial,
}: {
  initial: { dinnerTime: string; autopilotEnabled: boolean; autopilotDay: number; reminders: ReminderPrefs };
}) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const setPref = (key: keyof ReminderPrefs, on: boolean) => setValues({ ...values, reminders: { ...values.reminders, [key]: on } });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Autopilot and reminders</h2>
        <p className="text-sm text-muted">For the whole family. Each phone turns reminders on for itself, above.</p>
      </div>
      <Field label="Dinner is usually at">
        <input type="time" className={inputClass} value={values.dinnerTime} onChange={(e) => setValues({ ...values, dinnerTime: e.target.value })} />
      </Field>
      <div className="space-y-2">
        <Toggle
          label="Autopilot: plan next week's open nights automatically"
          checked={values.autopilotEnabled}
          onChange={(autopilotEnabled) => setValues({ ...values, autopilotEnabled })}
        />
        {values.autopilotEnabled ? (
          <label className="ml-8 flex items-center gap-2 text-sm">
            Every
            <select
              className="rounded-full border border-border bg-surface px-3 py-1"
              value={values.autopilotDay}
              onChange={(e) => setValues({ ...values, autopilotDay: Number(e.target.value) })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            morning. Votes from the Sunday session and dinners you picked are kept.
          </label>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Send reminders for</p>
        <Toggle label="🥶 Thawing: the night before, if tomorrow's dinner has meat" checked={values.reminders.thaw} onChange={(v) => setPref("thaw", v)} />
        <Toggle label="⏰ Start cooking: based on how long the recipe takes" checked={values.reminders.start} onChange={(v) => setPref("start", v)} />
        <Toggle label="⭐ Rate it: after dinner, to whoever ate" checked={values.reminders.rate} onChange={(v) => setPref("rate", v)} />
        <Toggle label="🗓️ Next week planned: when autopilot runs" checked={values.reminders.autopilot} onChange={(v) => setPref("autopilot", v)} />
        <Toggle label="✨ Recipe tweaks: when ratings suggest a change" checked={values.reminders.proposals} onChange={(v) => setPref("proposals", v)} />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setStatus(null);
              try {
                const result = await updateReminderSettings(values);
                setStatus("error" in result ? result.error : "Saved.");
              } catch {
                setStatus("That didn't save. Reload and try again.");
              }
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        {status ? <span className="text-sm text-muted">{status}</span> : null}
      </div>
    </Card>
  );
}
