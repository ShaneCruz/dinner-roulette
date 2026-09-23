"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { archiveRestaurant } from "../actions";
import { RestaurantForm } from "../restaurant-form";

type Values = { name: string; cuisine: string; area: string; website: string; phone: string; notes: string };

const LOOKING = ["Finding the menu…", "Reading every item so you don't have to…", "Checking what's actually mild…", "Picking a dish for everyone…"];

export function RestaurantTools({
  id,
  hasResearch,
  researchError,
  researchRunning,
  autoStart,
  aiOn,
  values,
}: {
  id: string;
  hasResearch: boolean;
  researchError: string | null;
  /** A lookup was already running when the page loaded */
  researchRunning: boolean;
  autoStart: boolean;
  aiOn: boolean;
  values: Values;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(researchRunning);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(researchError);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  /** Kicks off the lookup; the server keeps going even if the app is closed. */
  async function lookUp() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${id}/research`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Couldn't start the lookup. Try again.");
        setBusy(false);
        return;
      }
      router.replace(`/takeout/${id}`);
    } catch {
      // The request may have reached the server anyway; the check below will tell us.
      setError(null);
    }
  }

  // While a lookup is running, check back every few seconds. Picking the app
  // back up checks immediately, so a finished menu shows straight away.
  useEffect(() => {
    if (!busy) return;
    let stop = false;
    async function check() {
      try {
        const response = await fetch(`/api/restaurants/${id}/research`);
        if (!response.ok) return;
        const data = (await response.json()) as { status: "running" | "done" | "error" | "idle"; error?: string | null };
        if (stop || data.status === "running") return;
        setBusy(false);
        if (data.status === "error") setError(data.error ?? "That didn't work. Try again.");
        router.refresh();
      } catch {
        // Offline or asleep: try again on the next tick.
      }
    }
    const timer = setInterval(check, 5000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [busy, id, router]);

  useEffect(() => {
    if (autoStart && aiOn && !started.current) {
      started.current = true;
      void lookUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, aiOn]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setLine((l) => l + 1), 4000);
    return () => clearInterval(timer);
  }, [busy]);

  if (busy) {
    return (
      <Card className="py-8 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-mustard-soft border-t-tomato" aria-hidden />
        <p className="mt-4 font-bold">{LOOKING[line % LOOKING.length]}</p>
        <p className="text-sm text-muted">
          This takes a minute or two. You can leave the app: it keeps going, and the menu will be here when you come back.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {aiOn ? (
          <Button type="button" variant={hasResearch ? "secondary" : "primary"} size="sm" onClick={lookUp} title="Searches the web; costs about 20-40¢ of AI">
            {hasResearch ? "↻ Refresh the menu" : "🔎 Find the menu and picks"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? "Close" : "Edit details"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm("Remove this restaurant?")) {
              startTransition(async () => {
                await archiveRestaurant(id);
                router.push("/takeout");
              });
            }
          }}
        >
          Remove
        </Button>
      </div>
      {editing ? (
        <Card>
          <RestaurantForm
            id={id}
            initial={values}
            aiOn={aiOn}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </Card>
      ) : null}
    </div>
  );
}
