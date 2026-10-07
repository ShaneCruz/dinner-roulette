"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { RecipePicture } from "@/components/recipe-picture";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import type { DinnerTurn } from "@/lib/ai/dinner-picks";
import { CookTonight } from "../quick/cook-tonight";
import { askForDinnerAction, type DinnerIdea } from "./actions";

const STARTERS = [
  { label: "🍲 Slow cooker", text: "I'm home this morning, so something I can put in the slow cooker early." },
  { label: "🚗 Crazy evening", text: "Driving kids around all evening. Something really easy with almost no hands-on time." },
  { label: "🍝 No pasta", text: "We're sick of pasta. Something different." },
  { label: "🔥 Grill night", text: "We want to grill tonight." },
];

/** Quick replies once there are suggestions on screen. */
const NUDGES = [
  { label: "🔄 Something different", text: "None of those. Show me something different." },
  { label: "⚡ Even easier", text: "Those are too much work tonight. Even easier, please." },
  { label: "🥗 Lighter", text: "Something lighter and healthier." },
];

const THINKING = ["Looking through the recipe box…", "Checking what you've had lately…", "Weighing up tonight…"];

/** The back-and-forth so far, and the latest suggestions. */
type Session = {
  date: string;
  turns: DinnerTurn[];
  ideas: DinnerIdea[];
  note: string | null;
};

const STORE_KEY = "dinner-ideas";

/**
 * "What should we have tonight?" in plain words: time, energy, cravings,
 * the grill. Answers come from the family's own recipes, and she can reply
 * to steer them ("we've had a lot of pasta, something different").
 */
export function AskForDinner({ tonightTitle }: { tonightTitle: string | null }) {
  const [ask, setAsk] = useState("");
  const [reply, setReply] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [line, setLine] = useState(0);

  // Bring back the conversation after a look at one of the recipes, as long as it was for today.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as Session | null;
      if (saved?.date === new Date().toLocaleDateString("en-CA") && Array.isArray(saved.turns)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after the first render
        setSession(saved);
        setAsk(saved.turns[0]?.ask ?? "");
      }
    } catch {
      // Private browsing or nothing saved; start fresh.
    }
  }, []);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setLine((l) => l + 1), 2500);
    return () => clearInterval(id);
  }, [pending]);

  const save = (next: Session | null) => {
    setSession(next);
    try {
      if (next) sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {
      // Not saved; it just won't survive a trip to a recipe.
    }
  };

  /** Asks with the earlier rounds (a reply) or without them (a fresh start). */
  const send = (text: string, earlier: DinnerTurn[]) => {
    const message = text.trim();
    if (message.length < 3) return;
    const turns = [...earlier, { ask: message, shown: [] }];
    startTransition(async () => {
      setError(null);
      setLine(0);
      try {
        const result = await askForDinnerAction(turns);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        turns[turns.length - 1] = { ask: message, shown: result.ideas.map((idea) => idea.slug) };
        save({ date: result.tonight.date, turns, ideas: result.ideas, note: result.note });
        setReply("");
      } catch {
        setError("That didn't work. Check your signal and try again.");
      }
    });
  };

  const followUps = session?.turns.slice(1) ?? [];

  return (
    <Card className="mb-6 space-y-3 bg-gradient-to-br from-mustard-soft to-surface">
      <div>
        <h2 className="text-lg font-bold">🤔 What&apos;s tonight like?</h2>
        <p className="text-sm text-muted">Say what you&apos;re up against or in the mood for, and get dinners from your recipe box that fit.</p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(ask, []);
        }}
      >
        <textarea
          className={`${inputClass} min-h-20`}
          value={ask}
          maxLength={500}
          disabled={pending}
          placeholder="e.g. Soccer until 6:30, need something fast. Nothing with ground beef."
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(ask, []);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={pending}
              onClick={() => setAsk(s.text)}
              className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60"
            >
              {s.label}
            </button>
          ))}
          <Button type="submit" size="sm" disabled={pending || ask.trim().length < 3} className="ml-auto">
            {pending && !session ? "Thinking…" : session ? "Start over with this" : "Find dinners"}
          </Button>
        </div>
      </form>

      {session ? (
        <div className="space-y-3 border-t border-border/60 pt-3">
          {followUps.length ? (
            <ul className="space-y-1">
              {followUps.map((turn, i) => (
                <li key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3 py-1.5 text-sm text-background">
                  {turn.ask}
                </li>
              ))}
            </ul>
          ) : null}
          {session.note ? <p className="text-sm">{session.note}</p> : null}
          {tonightTitle && session.ideas.length ? (
            <p className="text-xs text-muted">Tonight is planned as {tonightTitle}; picking one of these replaces it.</p>
          ) : null}
          <ul className={`space-y-3 ${pending ? "opacity-50" : ""}`}>
            {session.ideas.map((idea, i) => (
              <li key={idea.id} className="flex gap-3 rounded-2xl bg-surface p-3">
                <Link href={`/recipes/${idea.slug}`} className="shrink-0">
                  <RecipePicture
                    src={idea.picture}
                    alt={idea.title}
                    className="h-24 w-24 rounded-xl bg-surface-muted object-cover sm:h-28 sm:w-36"
                    fallback={
                      <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-surface-muted text-3xl sm:h-28 sm:w-36" aria-hidden>
                        🍽️
                      </span>
                    }
                  />
                </Link>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link href={`/recipes/${idea.slug}`} className="block font-bold leading-tight hover:underline">
                    {i === 0 ? "⭐ " : ""}
                    {idea.title}
                  </Link>
                  <p className="text-sm">{idea.why}</p>
                  {idea.tip ? <p className="text-xs font-semibold text-plum">⏰ {idea.tip}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={idea.activeMinutes <= 20 ? "basil" : "neutral"}>⏱ {idea.activeMinutes} min hands-on</Badge>
                    {idea.totalMinutes - idea.activeMinutes >= 30 ? <Badge>{formatTotal(idea.totalMinutes)} total</Badge> : null}
                    <Badge>{idea.method}</Badge>
                  </div>
                  <CookTonight recipeId={idea.id} date={session.date} title={idea.title} />
                </div>
              </li>
            ))}
          </ul>

          <form
            className="space-y-2 rounded-2xl bg-surface/70 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(reply, session.turns);
            }}
          >
            <label className="block text-sm font-bold" htmlFor="dinner-reply">
              Not quite? Tell it what to change
            </label>
            <div className="flex gap-2">
              <input
                id="dinner-reply"
                className={inputClass}
                value={reply}
                maxLength={500}
                disabled={pending}
                placeholder="e.g. We've had a lot of pasta lately, something different"
                onChange={(e) => setReply(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={pending || reply.trim().length < 3} className="shrink-0 self-center">
                {pending ? "Thinking…" : "Send"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {NUDGES.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  disabled={pending}
                  onClick={() => send(n.text, session.turns)}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60"
                >
                  {n.label}
                </button>
              ))}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  save(null);
                  setAsk("");
                  setError(null);
                }}
                className="ml-auto text-xs font-semibold text-muted underline"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pending ? <p className="text-sm text-muted">{THINKING[line % THINKING.length]}</p> : null}
      {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
    </Card>
  );
}

function formatTotal(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 30) / 2;
  return `${hours}h`;
}
