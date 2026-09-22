"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, cx, inputClass } from "@/components/ui";
import type { Tone } from "@/lib/copy";
import { FACES, REASONS } from "@/lib/ratings/scale";
import { submitRatings } from "../actions";

type Person = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  stars: number | null;
  reasons: string[];
  note: string;
};

export function RateForm({ mealId, people, humor }: { mealId: string; people: Person[]; humor: Tone }) {
  const router = useRouter();
  const [entries, setEntries] = useState(people);
  const [open, setOpen] = useState<string | null>(people.length === 1 ? people[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (id: string, patch: Partial<Person>) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const rated = entries.filter((e) => e.stars !== null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitRatings(
          mealId,
          rated.map((e) => ({ memberId: e.id, stars: e.stars!, reasons: e.reasons as never[], note: e.note })),
        );
        if ("error" in result) setError(result.error);
        else {
          setDone(true);
          router.refresh();
        }
      } catch {
        setError("That didn't save. Reload the page and try again.");
      }
    });
  }

  if (done) {
    return (
      <Card className="py-10 text-center">
        <p className="text-5xl" aria-hidden>
          🏆
        </p>
        <p className="mt-3 text-xl font-bold">
          {humor === "goofball" ? "Thank you, food critic! The chef is blushing." : "Noted. The planner just got smarter."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setDone(false)}>
            Change a rating
          </Button>
          <Button type="button" onClick={() => router.push("/")}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((person) => {
        const expanded = open === person.id;
        return (
          <Card key={person.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar emoji={person.emoji} color={person.color} />
              <span className="flex-1 text-lg font-bold">{person.name}</span>
              {person.stars !== null && !expanded ? (
                <button type="button" className="text-sm text-muted underline" onClick={() => setOpen(person.id)}>
                  Why?
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1" role="radiogroup" aria-label={`${person.name}'s rating`}>
              {FACES.map((face) => (
                <button
                  key={face.stars}
                  type="button"
                  role="radio"
                  aria-checked={person.stars === face.stars}
                  aria-label={face.label}
                  onClick={() => {
                    update(person.id, { stars: face.stars });
                    if (face.stars <= 3) setOpen(person.id);
                  }}
                  className={cx(
                    "flex flex-col items-center rounded-2xl py-2 transition",
                    person.stars === face.stars ? "scale-105 bg-mustard-soft ring-2 ring-mustard" : "hover:bg-surface-muted",
                    person.stars !== null && person.stars !== face.stars && "opacity-40",
                  )}
                >
                  <span className="text-4xl">{face.emoji}</span>
                  <span className="mt-1 text-[10px] font-semibold leading-tight text-muted sm:text-xs">{face.label}</span>
                </button>
              ))}
            </div>
            {expanded ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {REASONS.map((reason) => {
                    const on = person.reasons.includes(reason.id);
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() =>
                          update(person.id, {
                            reasons: on ? person.reasons.filter((r) => r !== reason.id) : [...person.reasons, reason.id],
                          })
                        }
                        className={cx(
                          "rounded-full border px-3 py-1 text-sm",
                          on
                            ? reason.positive
                              ? "border-basil bg-basil-soft text-basil"
                              : "border-tomato bg-tomato-soft text-tomato-strong"
                            : "border-border text-muted",
                        )}
                      >
                        {reason.emoji} {reason.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  className={inputClass}
                  value={person.note}
                  onChange={(e) => update(person.id, { note: e.target.value })}
                  placeholder="Anything else? (optional)"
                  aria-label={`Note from ${person.name}`}
                />
              </div>
            ) : null}
          </Card>
        );
      })}
      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-20 flex justify-end sm:bottom-4">
        <Button type="button" size="lg" className="shadow-lg" disabled={pending || rated.length === 0} onClick={save}>
          {pending ? "Saving…" : rated.length === entries.length ? "Save ratings" : `Save ${rated.length} of ${entries.length}`}
        </Button>
      </div>
    </div>
  );
}
