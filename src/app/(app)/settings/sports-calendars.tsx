"use client";

import { useState, useTransition } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { addSportCalendarAction, refreshSportCalendarAction, removeSportCalendarAction } from "./actions";

export type CalendarSummary = {
  id: string;
  who: string;
  label: string;
  events: number;
  /** "Practice · Wed, Oct 7, 5:45 PM" */
  next: string | null;
  /** The last event's date, so a season that's over shows */
  lastDate: string | null;
  ended: boolean;
  error: string | null;
};

/** Team calendar feeds (TeamSnap, PlayerFirst, ...) for each kid, so dinner ideas know about practice. */
export function SportsCalendars({
  members,
  calendars,
  driveTimes,
}: {
  members: { id: string; name: string }[];
  calendars: CalendarSummary[];
  /** "on", or why drive times are off */
  driveTimes: "on" | "no-key" | "no-address";
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<void>) =>
    startTransition(async () => {
      setMessage(null);
      try {
        await work();
      } catch {
        setMessage({ ok: false, text: "That didn't work. Reload and try again." });
      }
    });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">⚽ Sports calendars</h2>
        <p className="text-sm text-muted">
          Practices and games from the team apps, so &ldquo;What&apos;s tonight like?&rdquo; can plan dinner around them. In
          TeamSnap, PlayerFirst and most team apps, look for <strong>Subscribe</strong>, <strong>Sync calendar</strong> or{" "}
          <strong>iCal</strong> and copy the link.
        </p>
        {driveTimes !== "on" ? (
          <p className="mt-2 rounded-2xl bg-mustard-soft px-3 py-2 text-sm">
            {driveTimes === "no-address"
              ? "Add your home address above to see drive times."
              : "Drive times are off: the app needs a Google Maps key (GOOGLE_MAPS_API_KEY)."}
          </p>
        ) : null}
      </div>

      {calendars.length ? (
        <ul className="space-y-2">
          {calendars.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {c.who} · {c.label}
                  </p>
                  <p className="text-sm text-muted">
                    {c.events} {c.events === 1 ? "event" : "events"}
                    {c.next ? ` · next: ${c.next}` : ""}
                  </p>
                  {c.ended ? (
                    <p className="text-sm font-semibold text-mustard">
                      Nothing after {c.lastDate}. Season over? Remove it, or add the new team&apos;s link.
                    </p>
                  ) : null}
                  {c.error ? <p className="text-sm font-semibold text-tomato-strong">Last check failed: {c.error}</p> : null}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm font-semibold text-plum disabled:opacity-60"
                    onClick={() => run(() => refreshSportCalendarAction(c.id))}
                  >
                    Check now
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm font-semibold text-muted disabled:opacity-60"
                    onClick={() => run(() => removeSportCalendarAction(c.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="space-y-3 rounded-2xl bg-surface-muted p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const result = await addSportCalendarAction({ memberId, label, url });
            if ("error" in result) setMessage({ ok: false, text: result.error });
            else {
              setMessage({ ok: true, text: `Added: found ${result.events} events.` });
              setLabel("");
              setUrl("");
            }
          });
        }}
      >
        <p className="text-sm font-bold">Add a team calendar</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Whose">
            <select className={inputClass} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sport or team">
            <input className={inputClass} placeholder="Soccer" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>
        <Field label="Calendar link">
          <input
            className={inputClass}
            inputMode="url"
            placeholder="webcal://… or https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || !memberId || !label.trim() || url.trim().length < 8}>
            {pending ? "Reading the calendar…" : "Add calendar"}
          </Button>
          {message ? (
            <span role="status" className={message.ok ? "text-sm text-basil" : "text-sm text-tomato-strong"}>
              {message.text}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
