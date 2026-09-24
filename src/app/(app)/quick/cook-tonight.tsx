"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { updateNight } from "../plan/actions";

/** Puts this dinner on tonight and sends you to the plan to see it. */
export function CookTonight({ recipeId, date, title }: { recipeId: string; date: string; title: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await updateNight(date, { recipeId });
              if (result?.error) setError(result.error);
              else router.push("/");
            } catch {
              setError("That didn't save. Try again.");
            }
          })
        }
      >
        {pending ? "Saving…" : "Make this tonight"}
      </Button>
      {error ? <span className="text-sm font-semibold text-tomato-strong">{error}</span> : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
