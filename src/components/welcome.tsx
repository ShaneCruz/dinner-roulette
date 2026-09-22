"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, cx } from "@/components/ui";
import { markWelcomed } from "@/app/(app)/welcome-actions";

type Panel = { emoji: string; title: string; body: string };

const PARENT: Panel[] = [
  {
    emoji: "🍽️",
    title: "Dinner, decided",
    body: "Cruz Meals plans the week around who's home, how much time you've got, and what everyone likes. Friday morning it plans next week on its own.",
  },
  {
    emoji: "🛒",
    title: "The list builds itself",
    body: "Every planned dinner adds its ingredients to Groceries, sorted by aisle and scaled to who's eating. It works in the store with no signal, and two people can split it.",
  },
  {
    emoji: "⭐",
    title: "Ratings do the teaching",
    body: "Tap a face after dinner, for yourself or for the kids. That's what makes next week's suggestions better, and complaints turn into fixes to the recipe.",
  },
];

const KID: Panel[] = [
  {
    emoji: "👋",
    title: "You get a say in dinner",
    body: "This is where the family decides what's for dinner. Your votes really do change what shows up on the table.",
  },
  {
    emoji: "⭐",
    title: "Rate every dinner",
    body: "After dinner, tap a face and say why. Ten seconds. It earns you badges and streaks on your trophy shelf.",
  },
  {
    emoji: "🚫",
    title: "Swipe, veto, spin",
    body: "On Sundays everyone swipes on dinners. You get one veto a week to kill something you can't stand, and you can spin the wheel on nights nobody has decided.",
  },
];

/** A short, one-time welcome the first time someone uses their profile. */
export function Welcome({ role, name }: { role: "parent" | "kid"; name: string }) {
  const panels = role === "parent" ? PARENT : KID;
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [, startTransition] = useTransition();
  const panel = panels[step];
  const last = step === panels.length - 1;

  function finish() {
    setClosed(true);
    startTransition(async () => {
      await markWelcomed();
    });
  }

  if (closed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-label={`Welcome, ${name}`} className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-xl">
        <p className="text-6xl" aria-hidden>
          {panel.emoji}
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold">
          {step === 0 ? `Hi ${name}! ` : ""}
          {panel.title}
        </h2>
        <p className="mt-2 text-muted">{panel.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {panels.map((_, i) => (
              <span key={i} className={cx("h-2 w-2 rounded-full", i === step ? "bg-tomato" : "bg-surface-muted")} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!last ? (
              <button type="button" onClick={finish} className="text-sm font-semibold text-muted">
                Skip
              </button>
            ) : null}
            <Button type="button" onClick={() => (last ? finish() : setStep(step + 1))}>
              {last ? "Let's eat" : "Next"}
            </Button>
          </div>
        </div>
        {last ? (
          <p className="mt-3 text-center text-sm">
            <Link href="/help" onClick={finish} className="font-semibold text-tomato underline">
              Show me how it all works
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
