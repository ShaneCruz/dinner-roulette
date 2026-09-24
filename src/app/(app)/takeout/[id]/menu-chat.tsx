"use client";

import { useRef, useState } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import { askMenuQuestion } from "../actions";
import type { ChatTurn } from "@/lib/ai/kitchen";

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

const STARTERS = [
  "I want something different from my usual",
  "What's good for comfort food?",
  "Something lighter tonight",
  "What should we share for the table?",
];

/**
 * Asking the menu a question, for the night you're bored of the usual. It has
 * read the whole menu, knows who's eating and what they normally order.
 */
export function MenuChat({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked || busy) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: asked }];
    setTurns(next);
    setQuestion("");
    setError(null);
    setBusy(true);
    try {
      const result = await askMenuQuestion(restaurantId, next);
      if ("error" in result) setError(result.error);
      else setTurns([...next, { role: "assistant", content: result.answer }]);
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
        💬 Ask about the menu
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">💬 Ask about {restaurantName}</h2>
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
          {busy ? <p className="mr-4 rounded-2xl bg-surface-muted px-3 py-2 text-muted">Reading the menu…</p> : null}
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
          placeholder="I usually get the gyros, but…"
          maxLength={400}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          Ask
        </Button>
      </form>
      <p className="text-xs text-muted">Answers use AI and count toward the weekly budget (about ½¢ a question).</p>
    </Card>
  );
}
