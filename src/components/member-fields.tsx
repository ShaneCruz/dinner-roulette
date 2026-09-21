"use client";

import { useState } from "react";
import { Avatar, Field, cx, inputClass } from "@/components/ui";
import { AVATAR_COLORS, AVATAR_EMOJIS, SPICE_LABELS, type MemberInput } from "@/lib/family";

export function MemberFields({
  value,
  onChange,
  lockRole = false,
}: {
  value: MemberInput;
  onChange: (next: MemberInput) => void;
  lockRole?: boolean;
}) {
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const set = <K extends keyof MemberInput>(key: K, v: MemberInput[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setPickingAvatar((p) => !p)}
          className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          aria-label="Change avatar"
        >
          <Avatar emoji={value.avatarEmoji} color={value.avatarColor} size="lg" />
        </button>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputClass}
              value={value.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Who's this?"
              required
            />
          </Field>
          <Field label="Role">
            <select
              className={inputClass}
              value={value.role}
              disabled={lockRole}
              onChange={(e) => {
                const role = e.target.value as "parent" | "kid";
                onChange({
                  ...value,
                  role,
                  authEmail: role === "parent" ? value.authEmail : "",
                });
              }}
            >
              <option value="parent">Parent</option>
              <option value="kid">Kid</option>
            </select>
          </Field>
        </div>
      </div>

      {pickingAvatar ? (
        <div className="rounded-2xl border border-border bg-surface-muted p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => set("avatarEmoji", emoji)}
                className={cx(
                  "h-10 w-10 rounded-xl text-2xl hover:bg-surface",
                  value.avatarEmoji === emoji && "bg-surface ring-2 ring-tomato",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set("avatarColor", color)}
                aria-label={`Color ${color}`}
                className={cx(
                  "h-8 w-8 rounded-full border-2",
                  value.avatarColor === color ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {value.role === "parent" ? (
          <Field label="Google email" hint="Used to sign in. Kids don't need one.">
            <input
              className={inputClass}
              type="email"
              value={value.authEmail ?? ""}
              onChange={(e) => set("authEmail", e.target.value)}
              placeholder="name@gmail.com"
            />
          </Field>
        ) : (
          <Field label="Birth year" hint="Optional. Helps pick age-appropriate jokes.">
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              value={value.birthYear ?? ""}
              onChange={(e) => set("birthYear", e.target.value ? Number(e.target.value) : null)}
              placeholder="2014"
            />
          </Field>
        )}
        <Field label="Chef title" hint="Just for fun. Kids can change it later.">
          <input
            className={inputClass}
            value={value.chefTitle ?? ""}
            onChange={(e) => set("chefTitle", e.target.value || null)}
            placeholder="Supreme Taco Commander"
          />
        </Field>
      </div>

      <Field label={`Spice tolerance: ${SPICE_LABELS[value.spiceTolerance]}`}>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={value.spiceTolerance}
          onChange={(e) => set("spiceTolerance", Number(e.target.value))}
          className="w-full accent-tomato"
        />
        <div className="flex justify-between text-lg" aria-hidden>
          <span>🧊</span>
          <span>🌶️</span>
          <span>🌶️🌶️</span>
          <span>🔥</span>
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Humor style</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["goofball", "Full goofball", "“TACO TUESDAY HAS BEEN SUMMONED!”"],
              ["dry", "Dry wit", "“Tacos. Again. Bold choice.”"],
            ] as const
          ).map(([id, label, example]) => (
            <label
              key={id}
              className={cx(
                "cursor-pointer rounded-2xl border p-3",
                value.humorDial === id ? "border-tomato bg-tomato-soft" : "border-border bg-surface",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                checked={value.humorDial === id}
                onChange={() => set("humorDial", id)}
              />
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-muted">{example}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Toggle
          checked={value.wantsHealthySwaps}
          onChange={(v) => set("wantsHealthySwaps", v)}
          label="Show healthy swaps (zucchini noodles and friends)"
        />
        <Toggle
          checked={value.prefersHighProtein}
          onChange={(v) => set("prefersHighProtein", v)}
          label="Likes lots of protein"
        />
        <Toggle
          checked={value.defaultPresence === "away"}
          onChange={(v) => set("defaultPresence", v ? "away" : "home")}
          label="Usually away (boarding school, college) — home only on breaks"
        />
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded accent-tomato"
      />
      <span>{label}</span>
    </label>
  );
}
