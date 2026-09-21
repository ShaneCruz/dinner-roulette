"use client";

import { useState, useTransition } from "react";
import { MemberFields, Toggle } from "@/components/member-fields";
import { Avatar, Badge, Button, Card, Field, cx, inputClass } from "@/components/ui";
import { AVATAR_COLORS, AVATAR_EMOJIS, type MemberInput } from "@/lib/family";
import { formatDateRange } from "@/lib/presence";
import {
  addFoodRule,
  archiveMember,
  confirmAvailability,
  deleteAvailability,
  removeFoodRule,
  saveAvailability,
  saveMember,
  setPin,
  updateOwnLook,
} from "./actions";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-2 text-sm text-tomato-strong">
      {error}
    </p>
  );
}

export function MemberEditor({
  id,
  initial,
  canArchive,
}: {
  id: string | null;
  initial: MemberInput;
  canArchive: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-4">
      <MemberFields value={value} onChange={setValue} />
      <ErrorText error={error} />
      <div className="flex justify-between gap-2">
        {id && canArchive ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${value.name} from the family? Their history stays.`)) {
                startTransition(() => archiveMember(id));
              }
            }}
          >
            Remove from family
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          disabled={pending || !value.name.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await saveMember(id, value);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

export function OwnLookEditor({
  initial,
}: {
  initial: { avatarEmoji: string; avatarColor: string; chefTitle: string | null };
}) {
  const [look, setLook] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar emoji={look.avatarEmoji} color={look.avatarColor} size="xl" />
        <Field label="Chef title" className="flex-1">
          <input
            className={inputClass}
            value={look.chefTitle ?? ""}
            onChange={(e) => setLook({ ...look, chefTitle: e.target.value || null })}
            placeholder="Supreme Taco Commander"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {AVATAR_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setLook({ ...look, avatarEmoji: emoji })}
            className={cx(
              "h-11 w-11 rounded-xl text-2xl hover:bg-surface-muted",
              look.avatarEmoji === emoji && "bg-surface-muted ring-2 ring-tomato",
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
            aria-label={`Color ${color}`}
            onClick={() => setLook({ ...look, avatarColor: color })}
            className={cx(
              "h-9 w-9 rounded-full border-2",
              look.avatarColor === color ? "border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <ErrorText error={error} />
      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-basil">Looking sharp! ✨</span> : null}
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setSaved(false);
            setError(null);
            startTransition(async () => {
              const result = await updateOwnLook(look);
              if (result?.error) setError(result.error);
              else setSaved(true);
            });
          }}
        >
          Save my look
        </Button>
      </div>
    </Card>
  );
}

export function PinEditor({ memberId, hasPin }: { memberId: string; hasPin: boolean }) {
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (value: string | null) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await setPin(memberId, value);
      if (result?.error) setError(result.error);
      else {
        setPinValue("");
        setMessage(value ? "PIN saved." : "PIN removed.");
      }
    });

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">PIN</h2>
        <p className="text-sm text-muted">
          {hasPin
            ? "This profile is locked with a 4-digit PIN."
            : "Optional. Stops siblings from rating dinner as each other (or a kid from acting as a parent)."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className={cx(inputClass, "w-32 text-center font-mono tracking-[0.5em]")}
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
          aria-label="New PIN"
        />
        <Button type="button" variant="secondary" disabled={pending || pin.length !== 4} onClick={() => run(pin)}>
          {hasPin ? "Change PIN" : "Set PIN"}
        </Button>
        {hasPin ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => run(null)}>
            Remove PIN
          </Button>
        ) : null}
      </div>
      <ErrorText error={error} />
      {message ? <p className="text-sm text-basil">{message}</p> : null}
    </Card>
  );
}

type Rule = {
  id: string;
  kind: "nope" | "love";
  ingredient: string | null;
  recipeTitle: string | null;
  note: string | null;
};

export function FoodRulesEditor({
  memberId,
  name,
  rules,
  recipes,
}: {
  memberId: string;
  name: string;
  rules: Rule[];
  recipes: { id: string; title: string }[];
}) {
  const [ingredient, setIngredient] = useState("");
  const [lovedRecipe, setLovedRecipe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (input: Parameters<typeof addFoodRule>[1], reset: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await addFoodRule(memberId, input);
      if (result?.error) setError(result.error);
      else reset();
    });

  const loves = rules.filter((r) => r.kind === "love");
  const nopes = rules.filter((r) => r.kind === "nope");

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Loves</h2>
        <p className="text-sm text-muted">Starting favorites. Ratings will teach the app the rest.</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {loves.map((rule) => (
            <RuleChip key={rule.id} tone="basil" label={rule.recipeTitle ?? rule.ingredient ?? ""} onRemove={() => startTransition(() => removeFoodRule(memberId, rule.id))} />
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <select className={inputClass} value={lovedRecipe} onChange={(e) => setLovedRecipe(e.target.value)} aria-label="Favorite recipe">
            <option value="">Pick a recipe…</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !lovedRecipe}
            onClick={() => add({ kind: "love", recipeId: lovedRecipe, ingredient: null, note: null }, () => setLovedRecipe(""))}
          >
            Add
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold">Won&apos;t eat</h2>
        <p className="text-sm text-muted">
          Hard nopes. Any dinner with these gets a swap for {name} or isn&apos;t suggested when {name} is eating.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {nopes.map((rule) => (
            <RuleChip key={rule.id} tone="tomato" label={rule.ingredient ?? rule.recipeTitle ?? ""} onRemove={() => startTransition(() => removeFoodRule(memberId, rule.id))} />
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add({ kind: "nope", ingredient: ingredient, recipeId: null, note: null }, () => setIngredient(""));
          }}
        >
          <input
            className={inputClass}
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            placeholder="ground beef, mushrooms, olives…"
            aria-label="Ingredient to avoid"
          />
          <Button type="submit" variant="secondary" disabled={pending || !ingredient.trim()}>
            Add
          </Button>
        </form>
      </div>
      <ErrorText error={error} />
    </Card>
  );
}

function RuleChip({ label, tone, onRemove }: { label: string; tone: "basil" | "tomato"; onRemove: () => void }) {
  return (
    <li>
      <Badge tone={tone} className="py-1 pl-3 pr-1 text-sm">
        {label}
        <button type="button" onClick={onRemove} className="ml-1 rounded-full px-1.5 hover:bg-surface" aria-label={`Remove ${label}`}>
          ×
        </button>
      </Badge>
    </li>
  );
}

type Range = {
  id: string;
  startDate: string;
  endDate: string;
  presence: "home" | "away";
  label: string;
  tentative: boolean;
  note: string | null;
};

const emptyRange = (defaultPresence: "home" | "away"): Omit<Range, "id"> => ({
  startDate: "",
  endDate: "",
  presence: defaultPresence === "away" ? "home" : "away",
  label: "",
  tentative: false,
  note: null,
});

export function AvailabilityEditor({
  memberId,
  name,
  defaultPresence,
  ranges,
  today,
}: {
  memberId: string;
  name: string;
  defaultPresence: "home" | "away";
  ranges: Range[];
  today: string;
}) {
  const [draft, setDraft] = useState<(Omit<Range, "id"> & { id: string | null }) | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upcoming = ranges.filter((r) => r.endDate >= today);
  const past = ranges.filter((r) => r.endDate < today);

  return (
    <Card id="availability" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Home &amp; away</h2>
        <p className="text-sm text-muted">
          {name} is usually <strong>{defaultPresence}</strong>. Add the exceptions: school breaks, trips, sleepovers.
          Travel days count as away when {name} gets in after dinner.
        </p>
      </div>

      <ul className="space-y-2">
        {upcoming.map((range) => (
          <RangeRow
            key={range.id}
            range={range}
            onEdit={() => setDraft(range)}
            onConfirm={() => startTransition(() => confirmAvailability(memberId, range.id))}
            onDelete={() => {
              if (confirm(`Delete “${range.label}”?`)) startTransition(() => deleteAvailability(memberId, range.id));
            }}
          />
        ))}
        {upcoming.length === 0 ? <li className="text-sm text-muted">Nothing coming up.</li> : null}
      </ul>

      {past.length > 0 ? (
        <div>
          <button type="button" className="text-sm font-semibold text-muted" onClick={() => setShowPast(!showPast)}>
            {showPast ? "Hide" : "Show"} past ({past.length})
          </button>
          {showPast ? (
            <ul className="mt-2 space-y-2 opacity-70">
              {past.map((range) => (
                <RangeRow
                  key={range.id}
                  range={range}
                  onEdit={() => setDraft(range)}
                  onDelete={() => startTransition(() => deleteAvailability(memberId, range.id))}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder={draft.presence === "home" ? "Winter break" : "Soccer tournament"}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <select
                className={inputClass}
                value={draft.presence}
                onChange={(e) => setDraft({ ...draft, presence: e.target.value as "home" | "away" })}
              >
                <option value="home">Home for dinner</option>
                <option value="away">Away</option>
              </select>
            </Field>
            <Field label="First dinner">
              <input
                type="date"
                className={inputClass}
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value, endDate: draft.endDate || e.target.value })
                }
              />
            </Field>
            <Field label="Last dinner">
              <input
                type="date"
                className={inputClass}
                value={draft.endDate}
                min={draft.startDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Note">
            <input
              className={inputClass}
              value={draft.note ?? ""}
              onChange={(e) => setDraft({ ...draft, note: e.target.value || null })}
              placeholder="Flight lands 9pm Friday"
            />
          </Field>
          <Toggle
            checked={draft.tentative}
            onChange={(tentative) => setDraft({ ...draft, tentative })}
            label="Not confirmed yet (remind us to confirm)"
          />
          <ErrorText error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const { id, ...input } = draft;
                  const result = await saveAvailability(memberId, id, input);
                  if (result?.error) setError(result.error);
                  else setDraft(null);
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setDraft({ id: null, ...emptyRange(defaultPresence) })}>
          + Add dates
        </Button>
      )}
    </Card>
  );
}

function RangeRow({
  range,
  onEdit,
  onConfirm,
  onDelete,
}: {
  range: Range;
  onEdit: () => void;
  onConfirm?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-border px-3 py-2">
      <Badge tone={range.presence === "home" ? "basil" : "neutral"}>{range.presence === "home" ? "Home" : "Away"}</Badge>
      <span className="font-semibold">{range.label}</span>
      <span className="text-sm text-muted">{formatDateRange(range.startDate, range.endDate)}</span>
      {range.tentative ? <Badge tone="mustard">Unconfirmed</Badge> : null}
      {range.note ? <span className="w-full text-xs text-muted">{range.note}</span> : null}
      <span className="ml-auto flex gap-1">
        {range.tentative && onConfirm ? (
          <Button type="button" size="sm" onClick={onConfirm}>
            Confirm
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDelete} aria-label={`Delete ${range.label}`}>
          ×
        </Button>
      </span>
    </li>
  );
}
