"use client";

import { cx } from "@/components/ui";
import { useDismissed } from "@/lib/dismissed";

/** A one-time hint on a page. Dismissed per device, and it stays dismissed. */
export function Tip({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const [dismissed, dismiss] = useDismissed(`cruz-meals-tip-${id}`);

  if (dismissed) return null;
  return (
    <div className={cx("mb-4 flex items-start gap-3 rounded-2xl bg-plum-soft px-4 py-3 text-sm", className)}>
      <span aria-hidden>💡</span>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        aria-label="Got it"
        className="shrink-0 font-semibold text-muted"
        onClick={dismiss}
      >
        Got it
      </button>
    </div>
  );
}
