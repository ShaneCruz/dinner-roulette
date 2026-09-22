"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addSideAction, recommendSidesAction, removeSideAction, type SideIdea } from "./actions";

const THINKING = ["Thinking about what goes with it…", "Checking your sides…", "Picturing the plate…"];
const WRITING = ["Writing the recipe…", "Adding it to your sides…", "Updating the grocery list…"];

/**
 * "Recommend sides" for a planned dinner: the family's own sides when they
 * fit, or easy new ideas that get written up and saved when chosen.
 */
export function SideRecommender({
  date,
  sides,
  canEdit,
}: {
  date: string;
  sides: { id: string; slug: string; title: string }[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ideas, setIdeas] = useState<SideIdea[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!loading && !adding) return;
    const id = setInterval(() => setLine((l) => l + 1), 3000);
    return () => clearInterval(id);
  }, [loading, adding]);

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await recommendSidesAction(date);
      if ("error" in result) setError(result.error);
      else setIdeas(result.ideas);
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function add(idea: SideIdea) {
    setAdding(idea.title);
    setError(null);
    try {
      const result = await addSideAction(date, { existingId: idea.existingId, title: idea.title });
      if ("error" in result) setError(result.error);
      else {
        setNotice(result.created ? `✓ Added ${result.title}, and saved the recipe to your sides.` : `✓ Added ${result.title}.`);
        setIdeas((all) => all?.filter((i) => i.title !== idea.title) ?? null);
      }
    } catch {
      setError("That didn't save. Reload and try again.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {sides.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {sides.map((s) => (
            <li key={s.id} className="flex items-center gap-1 rounded-full bg-basil-soft py-0.5 pl-3 pr-1 text-sm">
              <Link href={`/recipes/${s.slug}`} className="font-semibold text-basil">
                {s.title}
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${s.title}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface"
                  onClick={() => void removeSideAction(date, s.id)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        open ? (
          <div className="space-y-2 rounded-2xl border border-basil/30 bg-basil-soft/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">🥗 Sides that go with it</p>
              <button type="button" className="text-xs font-semibold text-muted" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {loading ? <p className="text-sm text-muted">{THINKING[line % THINKING.length]}</p> : null}
            {notice ? <p className="text-sm font-semibold text-basil">{notice}</p> : null}
            {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
            {ideas?.length ? (
              <ul className="space-y-2">
                {ideas.map((idea) => (
                  <li key={idea.title} className="flex items-start gap-3 rounded-xl bg-surface p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {idea.healthy ? "🥦 " : ""}
                        {idea.title}
                        {!idea.existingId ? <span className="ml-1.5 rounded-full bg-plum-soft px-2 py-0.5 text-xs text-plum">new</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {idea.why} · {idea.handsOnMinutes} min
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(adding)}
                      onClick={() => add(idea)}
                      className="shrink-0 rounded-full bg-basil px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {adding === idea.title ? (idea.existingId ? "Adding…" : WRITING[line % WRITING.length]) : "+ Add"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {ideas && !loading ? (
              <button type="button" className="text-xs font-semibold text-plum" onClick={load} disabled={Boolean(adding)}>
                ↻ Other ideas
              </button>
            ) : null}
            {ideas?.some((i) => !i.existingId) ? (
              <p className="text-xs text-muted">New ideas get a simple recipe written and saved to your sides when you add them.</p>
            ) : null}
          </div>
        ) : (
          <button type="button" onClick={load} className="text-sm font-semibold text-basil">
            🥗 {sides.length ? "More sides" : "Recommend sides"}
          </button>
        )
      ) : null}
    </div>
  );
}
