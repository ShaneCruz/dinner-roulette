"use client";

import { useState, useTransition } from "react";
import { Button, inputClass } from "@/components/ui";
import { setSourceRatingAction } from "../actions";

/** Lets a parent type in a recipe's rating from Allrecipes (or wherever it came from). */
export function SourceRatingEditor({ recipeId, initialSite }: { recipeId: string; initialSite: string | null }) {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState(initialSite ?? "Allrecipes");
  const [rating, setRating] = useState("");
  const [count, setCount] = useState("");
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" className="text-xs font-semibold text-muted underline" onClick={() => setOpen(true)}>
        ⭐ Add its rating from Allrecipes
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <label className="text-xs font-semibold text-muted">
        Site
        <input className={`${inputClass} mt-1 w-32`} value={site} onChange={(e) => setSite(e.target.value)} />
      </label>
      <label className="text-xs font-semibold text-muted">
        Stars
        <input className={`${inputClass} mt-1 w-20`} inputMode="decimal" placeholder="4.8" value={rating} onChange={(e) => setRating(e.target.value)} />
      </label>
      <label className="text-xs font-semibold text-muted">
        Ratings
        <input className={`${inputClass} mt-1 w-28`} inputMode="numeric" placeholder="12345" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const toNumber = (v: string) => (v.trim() ? Number(v.replace(/[,\s]/g, "")) : null);
            await setSourceRatingAction(recipeId, { site, rating: toNumber(rating), count: toNumber(count) });
            setOpen(false);
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
