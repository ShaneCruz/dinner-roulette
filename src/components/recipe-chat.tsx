"use client";

import { useRef, useState } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import { askRecipeQuestion, requestTweakAction, type ChatTurn } from "@/app/(app)/recipes/actions";

/** Answers come back with a little markdown; show bold and bullets properly. */
function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").filter((line) => line.trim()).map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = (bullet ? line.replace(/^\s*[-*•]\s+/, "") : line).split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className={cx("leading-snug", bullet && "ml-4 list-item list-disc", i > 0 && "mt-1.5")}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>,
            )}
          </p>
        );
      })}
    </>
  );
}

const STARTERS = ["Can I use 2% milk instead?", "What can I swap for this?", "Which of our sides goes with it?", "How do I know when it's done?"];

/**
 * Questions about the dish you're cooking. It knows the recipe, tonight's
 * servings and the family's tastes, so answers are specific. When an answer
 * is really a change worth keeping, it offers to save it as a recipe tweak.
 */
export function RecipeChat({ recipeId, title, canTweak }: { recipeId: string; title: string; canTweak: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tweak, setTweak] = useState<string | null>(null);
  const [tweakState, setTweakState] = useState<"idle" | "saving" | "saved">("idle");
  const box = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked || busy) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: asked }];
    setTurns(next);
    setQuestion("");
    setError(null);
    setTweak(null);
    setBusy(true);
    try {
      const result = await askRecipeQuestion(recipeId, next);
      if ("error" in result) setError(result.error);
      else {
        setTurns([...next, { role: "assistant", content: result.answer }]);
        setTweak(result.tweak);
      }
    } catch {
      setError("Lost the connection. Ask again.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-muted hover:border-tomato hover:text-tomato"
      >
        💬 Ask about {title}
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">💬 Ask about this recipe</h2>
        <button type="button" className="text-sm font-semibold text-muted" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {turns.length ? (
        <div ref={box} className="max-h-80 space-y-3 overflow-y-auto">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={cx(
                "rounded-2xl px-3 py-2",
                turn.role === "user" ? "ml-8 whitespace-pre-line bg-tomato-soft" : "mr-4 bg-surface-muted",
              )}
            >
              {turn.role === "user" ? turn.content : <Answer text={turn.content} />}
            </div>
          ))}
          {busy ? <p className="mr-4 rounded-2xl bg-surface-muted px-3 py-2 text-muted">Thinking…</p> : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => void ask(starter)}
              className="rounded-full bg-surface-muted px-3 py-1.5 text-sm font-semibold"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {tweak && canTweak ? (
        <div className="rounded-2xl bg-plum-soft p-3 text-sm">
          <p className="font-semibold">Keep this change in the recipe?</p>
          <p className="mt-0.5">{tweak}</p>
          {tweakState === "saved" ? (
            <p className="mt-2 font-semibold text-plum">✓ Suggested tweak is ready on the recipe page.</p>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={tweakState === "saving"}
              onClick={async () => {
                setTweakState("saving");
                try {
                  const result = await requestTweakAction(recipeId, tweak);
                  if (result?.error) {
                    setError(result.error);
                    setTweakState("idle");
                  } else setTweakState("saved");
                } catch {
                  setError("That didn't work. Try again.");
                  setTweakState("idle");
                }
              }}
            >
              {tweakState === "saving" ? "Working on it…" : "✨ Turn it into a recipe tweak"}
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          className={inputClass}
          value={question}
          placeholder="Ask anything about this recipe…"
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          Ask
        </Button>
      </form>
      <p className="text-xs text-muted">Answers use AI and count toward the weekly budget (about ¼¢ a question).</p>
    </Card>
  );
}
