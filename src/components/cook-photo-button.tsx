"use client";

import { useRef, useState, useTransition } from "react";
import { addCookPhotoAction } from "@/app/(app)/recipes/actions";
import { cx } from "@/components/ui";
import { shrinkImage } from "@/lib/shrink-image";

/**
 * "📸 Snap it": adds a photo of the dish as made to the recipe's log. It
 * never replaces the recipe's main picture; that's a choice made on the
 * recipe page.
 */
export function CookPhotoButton({
  recipeId,
  mealId = null,
  label = "📸 Add a photo of it",
  className,
}: {
  recipeId: string;
  /** The planned dinner it belongs to, so it's dated that night */
  mealId?: string | null;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          startTransition(async () => {
            setStatus(null);
            try {
              const form = new FormData();
              form.set("photo", await shrinkImage(file, 1400));
              const result = await addCookPhotoAction(recipeId, mealId, form);
              setStatus(result?.error ? { ok: false, text: result.error } : { ok: true, text: "📸 Saved. Looking good, chef." });
            } catch {
              setStatus({ ok: false, text: "That didn't save. Check your signal and try again." });
            }
          });
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className={cx(
          "rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60",
          className,
        )}
      >
        {pending ? "Saving the photo…" : label}
      </button>
      {status ? <span className={cx("text-sm", status.ok ? "text-basil" : "text-tomato-strong")}>{status.text}</span> : null}
    </span>
  );
}
