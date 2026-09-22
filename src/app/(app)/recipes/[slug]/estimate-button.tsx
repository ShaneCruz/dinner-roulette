"use client";

import { useState, useTransition } from "react";
import { estimateNutritionAction } from "../actions";

export function EstimateNutritionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="font-semibold text-tomato disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await estimateNutritionAction(id);
              if (result?.error) setError(result.error);
            } catch {
              setError("That didn't work. Try again.");
            }
          })
        }
      >
        {pending ? "Estimating…" : "Estimate now"}
      </button>
      {error ? <span className="text-tomato-strong">{error}</span> : null}
    </span>
  );
}
