"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { updateNight } from "./plan/actions";

export function MadeItButton({ date }: { date: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(async () => void (await updateNight(date, { status: "cooked" })))}
    >
      {pending ? "Saving…" : "✓ We made it"}
    </Button>
  );
}
