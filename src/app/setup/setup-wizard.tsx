"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { MemberFields, Toggle } from "@/components/member-fields";
import { Avatar, Button, Card, Field, cx, inputClass } from "@/components/ui";
import {
  APPLIANCES,
  TIMEZONES,
  defaultMember,
  type MemberInput,
  type SettingsInput,
} from "@/lib/family";
import { completeSetup } from "./actions";

type Starter = { slug: string; title: string; kind: "main" | "side" };

const STEPS = ["Family", "People", "Kitchen", "Recipes"] as const;
const DEFAULT_TIMEZONE = "America/Chicago";
const noopSubscribe = () => () => {};

export function SetupWizard({
  starters,
  signedInName,
  signedInEmail,
}: {
  starters: Starter[];
  signedInName: string;
  signedInEmail: string;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [settings, setSettings] = useState<SettingsInput>(() => ({
    familyName: "",
    homeZip: "",
    timezone: DEFAULT_TIMEZONE,
    appliances: ["sheet_pan"],
    weeknightActiveMinutes: 30,
    healthyNightsTarget: 5,
    defaultCooldownDays: 14,
    chaosSliceEnabled: true,
  }));

  const [members, setMembers] = useState<MemberInput[]>(() => [
    { ...defaultMember("parent", 0), name: signedInName, authEmail: signedInEmail },
  ]);
  const [editing, setEditing] = useState<number | null>(0);
  const [starterSlugs, setStarterSlugs] = useState<string[]>(() => starters.map((s) => s.slug));

  // The server doesn't know the browser's time zone, so it renders a default
  // and the browser's zone takes over after hydration unless one is picked.
  const browserZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
    () => DEFAULT_TIMEZONE,
  );
  const [pickedZone, setPickedZone] = useState<string | null>(null);
  const timezone = pickedZone ?? browserZone;

  const canContinue = [
    settings.familyName.trim().length > 0,
    members.length > 0 && members.every((m) => m.name.trim()),
    true,
    true,
  ][step];

  function next() {
    setError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await completeSetup({
        settings: { ...settings, timezone },
        members,
        starterSlugs,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="text-5xl" aria-hidden>
          🧑‍🍳
        </div>
        <h1 className="mt-2 text-3xl font-bold">Let&apos;s set up your kitchen</h1>
        <p className="mt-1 text-muted">Takes about three minutes. You can change anything later.</p>
      </div>

      <ol className="mb-6 flex gap-2" aria-label="Setup steps">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <div
              className={cx(
                "h-2 rounded-full",
                index <= step ? "bg-tomato" : "bg-border",
              )}
            />
            <span
              className={cx(
                "mt-1 block text-center text-xs font-semibold",
                index === step ? "text-foreground" : "text-muted",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Your family</h2>
            <Field label="Family name" hint="Shown at the top of the app.">
              <input
                className={inputClass}
                value={settings.familyName}
                onChange={(e) => setSettings({ ...settings, familyName: e.target.value })}
                placeholder="The Hungry Hendersons"
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Home ZIP code" hint="Optional. For grill-night weather checks.">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={5}
                  value={settings.homeZip}
                  onChange={(e) => setSettings({ ...settings, homeZip: e.target.value })}
                  placeholder="60045"
                />
              </Field>
              <Field label="Time zone">
                <select
                  className={inputClass}
                  value={timezone}
                  onChange={(e) => setPickedZone(e.target.value)}
                >
                  {[...new Set([timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace("America/", "").replace("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Who eats here?</h2>
              <p className="text-sm text-muted">
                Add everyone, including anyone who&apos;s only home sometimes.
              </p>
            </div>
            <ul className="space-y-3">
              {members.map((m, index) => (
                <li key={index} className="rounded-2xl border border-border p-3">
                  {editing === index ? (
                    <div>
                      <MemberFields
                        value={m}
                        onChange={(nextMember) =>
                          setMembers(members.map((x, i) => (i === index ? nextMember : x)))
                        }
                      />
                      <div className="mt-4 flex justify-between">
                        {members.length > 1 ? (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setMembers(members.filter((_, i) => i !== index));
                              setEditing(null);
                            }}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span />
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={!m.name.trim()}
                          onClick={() => setEditing(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => setEditing(index)}
                    >
                      <Avatar emoji={m.avatarEmoji} color={m.avatarColor} />
                      <span className="flex-1">
                        <span className="block font-semibold">{m.name || "Unnamed"}</span>
                        <span className="block text-sm text-muted">
                          {m.role === "parent" ? "Parent" : "Kid"}
                          {m.defaultPresence === "away" ? " · usually away" : ""}
                        </span>
                      </span>
                      <span className="text-sm text-tomato">Edit</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {(["parent", "kid"] as const).map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setMembers([...members, defaultMember(role, members.length)]);
                    setEditing(members.length);
                  }}
                >
                  + Add {role}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold">Your kitchen</h2>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">What do you cook with?</legend>
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
            </fieldset>
            <NumberChoice
              label="Hands-on cooking time on a weeknight"
              value={settings.weeknightActiveMinutes}
              options={[20, 30, 45, 60]}
              format={(v) => `${v} min`}
              onChange={(v) => setSettings({ ...settings, weeknightActiveMinutes: v })}
            />
            <NumberChoice
              label="Healthy dinners per week (the rest can be comfort food)"
              value={settings.healthyNightsTarget}
              options={[3, 4, 5, 6]}
              format={(v) => `${v} of 7`}
              onChange={(v) => setSettings({ ...settings, healthyNightsTarget: v })}
            />
            <NumberChoice
              label="Wait at least this long before repeating a meal"
              value={settings.defaultCooldownDays}
              options={[7, 10, 14, 21]}
              format={(v) => `${v} days`}
              onChange={(v) => setSettings({ ...settings, defaultCooldownDays: v })}
            />
            <Toggle
              label="Chaos slice on the wheel (rare surprise results)"
              checked={settings.chaosSliceEnabled}
              onChange={(v) => setSettings({ ...settings, chaosSliceEnabled: v })}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Starter recipes</h2>
              <p className="text-sm text-muted">
                Simple, weeknight-friendly family classics. Uncheck anything you never make.
              </p>
            </div>
            {(["main", "side"] as const).map((kind) => (
              <fieldset key={kind}>
                <legend className="mb-2 text-sm font-semibold">
                  {kind === "main" ? "Dinners" : "Sides"}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {starters
                    .filter((s) => s.kind === kind)
                    .map((starter) => (
                      <Toggle
                        key={starter.slug}
                        label={starter.title}
                        checked={starterSlugs.includes(starter.slug)}
                        onChange={(checked) =>
                          setStarterSlugs(
                            checked
                              ? [...starterSlugs, starter.slug]
                              : starterSlugs.filter((s) => s !== starter.slug),
                          )
                        }
                      />
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || pending}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={next}
            disabled={!canContinue || pending || (step === 1 && editing !== null)}
          >
            {step === STEPS.length - 1 ? (pending ? "Setting the table…" : "Finish setup") : "Next"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NumberChoice({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cx(
              "rounded-full border px-4 py-2 text-sm font-semibold",
              value === option
                ? "border-tomato bg-tomato text-white"
                : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
