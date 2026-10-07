"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

/**
 * Type a side: matches from the family's sides come up as you go, and
 * anything else ("skillet zucchini") can be added as a new side.
 */
export function SideSearch({
  sides,
  onPick,
  onAddNew,
  disabled = false,
  autoFocus = false,
}: {
  /** The family's sides that aren't on the plate yet */
  sides: { id: string; title: string }[];
  onPick: (id: string) => void;
  onAddNew: (title: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState("");
  const typed = term.trim();
  const lower = typed.toLowerCase();
  // Any word counts, so "zucchini squash" still finds "Roasted Zucchini"; the most words matched come first.
  const words = lower.split(/\s+/).filter((w) => w.length >= 3);
  const hits = (title: string) => words.filter((w) => title.toLowerCase().includes(w)).length;
  const matches = lower
    ? sides
        .filter((s) => s.title.toLowerCase().includes(lower) || hits(s.title) > 0)
        .sort((a, b) => hits(b.title) - hits(a.title))
        .slice(0, 6)
    : [];
  const exact = matches.find((s) => s.title.toLowerCase() === lower);
  const done = () => setTerm("");

  return (
    <div className="space-y-2">
      <input
        className={inputClass}
        type="search"
        placeholder="Type a side, e.g. skillet zucchini"
        value={term}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={80}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !typed) return;
          e.preventDefault();
          if (exact) onPick(exact.id);
          else onAddNew(typed);
          done();
        }}
      />
      {typed ? (
        <div className="flex flex-wrap gap-2">
          {matches.map((side) => (
            <button
              key={side.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onPick(side.id);
                done();
              }}
              className="rounded-full border border-basil bg-surface px-3 py-1.5 text-sm font-semibold text-basil disabled:opacity-60"
            >
              + {side.title}
            </button>
          ))}
          {!exact ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onAddNew(typed);
                done();
              }}
              className="rounded-full border border-dashed border-plum px-3 py-1.5 text-sm font-semibold text-plum disabled:opacity-60"
            >
              + Add “{typed}” as a new side
            </button>
          ) : null}
        </div>
      ) : null}
      {typed && !exact ? (
        <p className="text-xs text-muted">
          A new side gets a short recipe written, so its ingredients land on the grocery list. Takes about 30 seconds.
        </p>
      ) : null}
    </div>
  );
}
