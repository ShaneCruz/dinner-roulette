"use client";

import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { useDismissed } from "@/lib/dismissed";
import type { SetupStep } from "@/lib/setup-progress";

const HIDDEN = "cruz-meals-setup-hidden";

/**
 * The parents' setup checklist on the Tonight page. Steps tick themselves
 * off from real data, and the card disappears once everything's done.
 */
export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const [hidden, hide] = useDismissed(HIDDEN);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  if (!next || hidden) return null;

  return (
    <Card className="space-y-3 border-mustard bg-mustard-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">🧰 Getting set up</h2>
        <p className="text-sm font-semibold">
          {done} of {steps.length} done
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className="h-full rounded-full bg-basil transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className={cx("flex gap-2.5", step.done && "text-muted")}>
            <span aria-hidden className={cx("shrink-0 font-bold", step.done ? "text-basil" : "text-muted")}>
              {step.done ? "✓" : "○"}
            </span>
            <div className="min-w-0">
              {step.done ? (
                <span className="line-through">{step.label}</span>
              ) : (
                <Link href={step.href} className="font-semibold text-tomato-strong underline underline-offset-2">
                  {step.label}
                </Link>
              )}
              {!step.done ? <p className="text-sm text-muted">{step.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/help" className="font-semibold text-tomato-strong">
          How it all works →
        </Link>
        <button
          type="button"
          className="text-muted"
          onClick={hide}
        >
          Hide this
        </button>
      </div>
    </Card>
  );
}
