"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { discardDraft, retireRecipe } from "../../actions";

export function RetireButton({ id, title }: { id: string; title: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (done) return <span className="text-xs font-semibold text-basil">Retired ✓</span>;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await retireRecipe(id);
          setDone(true);
        })
      }
      aria-label={`Retire ${title}`}
    >
      Retire it
    </Button>
  );
}

export function DraftActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-semibold text-muted underline"
      onClick={() => {
        if (confirm("Throw this recipe away?")) startTransition(() => discardDraft(id));
      }}
    >
      Not what I wanted, throw it away
    </button>
  );
}
