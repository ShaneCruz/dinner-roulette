"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import type { IngredientChange } from "@/lib/recipes/diff";
import { acceptProposalAction, dismissProposalAction, requestTweakAction, undoChangeAction } from "../actions";

type Proposal = {
  id: string;
  trigger: "ratings" | "request";
  request: string | null;
  summary: string;
  changes: string[];
  diff: { ingredients: IngredientChange[]; facts: string[]; stepsChanged: boolean };
  newSteps: string[];
};

const THINKING = ["Reading everyone's ratings…", "Tasting it in my head…", "Adjusting the amounts…", "Rewriting the steps…"];

/**
 * Parents see suggested changes from ratings here, can ask for their own
 * ("more tomatoes, same beef"), and can undo the last accepted change.
 */
export function RecipeTweaks({
  recipeId,
  proposal,
  complaints,
  lastChange,
}: {
  recipeId: string;
  proposal: Proposal | null;
  complaints: string[];
  lastChange: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setLine((l) => l + 1), 4000);
    return () => clearInterval(id);
  }, [pending]);

  const run = (work: () => Promise<{ error: string } | void>) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await work();
        if (result?.error) setError(result.error);
      } catch {
        setError("That didn't work. Reload and try again.");
      }
    });

  if (proposal) {
    return (
      <Card className="mb-6 space-y-3 border-plum/40 bg-plum-soft">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-plum">
            ✨ Suggested tweak · {proposal.trigger === "ratings" ? "from your ratings" : "you asked"}
          </p>
          {proposal.request ? <p className="mt-1 text-sm text-muted">“{proposal.request}”</p> : null}
          <p className="mt-2 text-lg font-bold">{proposal.summary}</p>
        </div>
        {proposal.changes.length ? (
          <ul className="ml-5 list-disc space-y-1 text-sm">
            {proposal.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {proposal.diff.ingredients.length || proposal.diff.facts.length ? (
          <div className="rounded-2xl bg-surface p-3 text-sm">
            {proposal.diff.facts.map((f) => (
              <p key={f} className="font-semibold">
                {f}
              </p>
            ))}
            <ul className="mt-1 space-y-1">
              {proposal.diff.ingredients.map((c) => (
                <li key={`${c.type}-${c.name}`}>
                  {c.type === "added" ? (
                    <span className="text-basil">
                      + {c.to} {c.name}
                    </span>
                  ) : c.type === "removed" ? (
                    <span className="text-tomato-strong line-through">
                      {c.from} {c.name}
                    </span>
                  ) : (
                    <span>
                      {c.name}: <span className="text-muted line-through">{c.from}</span> → <span className="font-semibold">{c.to}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {proposal.diff.stepsChanged ? (
              <button type="button" className="mt-2 font-semibold text-plum" onClick={() => setShowSteps(!showSteps)}>
                {showSteps ? "Hide the new steps" : "The steps changed too. Show them"}
              </button>
            ) : null}
            {showSteps ? (
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                {proposal.newSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => run(() => acceptProposalAction(proposal.id))}>
            {pending ? "Saving…" : "✓ Use this version"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => run(async () => void (await dismissProposalAction(proposal.id)))}>
            No thanks
          </Button>
        </div>
        <p className="text-xs text-muted">You can undo it later. The current version is saved.</p>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-2">
      {lastChange ? (
        <p className="text-sm text-muted">
          Last change: {lastChange}{" "}
          <button
            type="button"
            disabled={pending}
            className="font-semibold text-tomato underline"
            onClick={() => {
              if (window.confirm("Put the recipe back the way it was before this change?")) run(() => undoChangeAction(recipeId));
            }}
          >
            Undo
          </button>
        </p>
      ) : null}
      {open ? (
        <Card className="space-y-3">
          <p className="font-bold">✨ Tweak this recipe</p>
          {complaints.length ? <p className="text-sm text-muted">Ratings mention: {complaints.join(", ")}.</p> : null}
          <textarea
            className={cx(inputClass, "min-h-20")}
            value={request}
            maxLength={1000}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Less meat, more tomatoes and sauce. Keep the beef the same."
          />
          {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || request.trim().length < 3} onClick={() => run(() => requestTweakAction(recipeId, request))}>
              {pending ? THINKING[line % THINKING.length] : "Suggest changes"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted">You&apos;ll see exactly what changes before anything is saved.</p>
        </Card>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-plum">
          ✨ Tweak this recipe{complaints.length ? ` (ratings mention ${complaints.slice(0, 2).join(", ")})` : ""}
        </button>
      )}
    </div>
  );
}
