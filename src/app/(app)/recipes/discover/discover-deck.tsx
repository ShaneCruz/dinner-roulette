"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, SpiceMeter, cx } from "@/components/ui";
import { dealMoreAction, decideIdeaAction, type IdeaCard } from "./actions";

type Recent = { id: string; title: string; emoji: string; status: string; slug: string | null };

const DEALING = ["Raiding the world's cookbooks…", "Checking what kids actually eat…", "Skipping anything with raisins…", "Shuffling the deck…"];
const HEALTH = { healthy: "🥦 Healthy", balanced: "⚖️ Balanced", comfort: "🛋️ Comfort" } as const;

function minutes(total: number) {
  return total < 60 ? `${total} min` : `${Math.round((total / 60) * 2) / 2}h`;
}

/** Tinder for dinners: right to add it to the recipe box, left to pass. */
export function DiscoverDeck({ initialIdeas, recent: saved }: { initialIdeas: IdeaCard[]; recent: Recent[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initialIdeas);
  // Yeses from this visit show right away; the server's list takes over once it has them.
  const [justAdded, setJustAdded] = useState<Recent[]>([]);
  const recent = [...justAdded.filter((a) => !saved.some((r) => r.id === a.id)), ...saved];
  const [dealing, setDealing] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const start = useRef<number | null>(null);
  const decided = useRef(new Set<string>());
  const asked = useRef(false);

  const current = queue[0] ?? null;
  const writing = recent.some((r) => r.status === "writing");

  async function dealMore() {
    if (dealing) return;
    setDealing(true);
    setError(null);
    try {
      const result = await dealMoreAction();
      if ("error" in result) setError(result.error);
      else setQueue((q) => [...q, ...result.ideas.filter((i) => !decided.current.has(i.id) && !q.some((x) => x.id === i.id))]);
    } catch {
      setError("Couldn't get more ideas. Try again.");
    } finally {
      setDealing(false);
    }
  }

  // Keep the deck stocked: deal more when it runs low.
  useEffect(() => {
    if (queue.length <= 2 && !asked.current) {
      asked.current = true;
      void dealMore();
    }
    if (queue.length > 2) asked.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  useEffect(() => {
    if (!dealing) return;
    const id = setInterval(() => setLine((l) => l + 1), 3500);
    return () => clearInterval(id);
  }, [dealing]);

  // Check back while recipes are being written.
  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [writing, router]);

  function decide(yes: boolean) {
    if (!current) return;
    const idea = current;
    decided.current.add(idea.id);
    setQueue((q) => q.slice(1));
    setFlash(yes ? `😍 Added ${idea.title}` : "👋 Pass");
    window.setTimeout(() => setFlash(null), 1400);
    if (yes) setJustAdded((r) => [{ id: idea.id, title: idea.title, emoji: idea.emoji, status: "writing", slug: null }, ...r]);
    decideIdeaAction(idea.id, yes)
      .then((result) => {
        if ("error" in result) setError(result.error);
      })
      .catch(() => setError("Lost the connection. That swipe may not have saved."));
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl bg-tomato-soft px-4 py-2 text-sm font-semibold text-tomato-strong">{error}</p> : null}

      {current ? (
        <div className="relative">
          <Card
            key={current.id}
            className="touch-none select-none space-y-3 p-6"
            style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 18}deg)` : undefined, transition: drag ? "none" : "transform 200ms" }}
            onPointerDown={(e) => {
              start.current = e.clientX;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
            onPointerUp={() => {
              const d = drag;
              start.current = null;
              setDrag(0);
              if (d > 90) decide(true);
              else if (d < -90) decide(false);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDrag(0);
            }}
          >
            <div className="text-6xl" aria-hidden>
              {current.emoji}
            </div>
            <h2 className="text-2xl font-bold leading-tight">{current.title}</h2>
            <p className="text-muted">{current.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{current.cuisine}</Badge>
              <Badge tone={current.healthCategory === "healthy" ? "basil" : current.healthCategory === "comfort" ? "mustard" : "neutral"}>
                {HEALTH[current.healthCategory]}
              </Badge>
              <Badge>
                ⏱ {current.activeMinutes} min hands-on{current.totalMinutes > current.activeMinutes + 15 ? ` · ${minutes(current.totalMinutes)} total` : ""}
              </Badge>
              {current.spiceLevel > 0 ? <SpiceMeter level={current.spiceLevel} /> : null}
            </div>
            {current.kidAppeal ? <p className="text-sm">🧒 {current.kidAppeal}</p> : null}
            {current.twistOn ? <p className="text-sm text-plum">✨ A twist on your {current.twistOn}</p> : null}
            <a
              href={`https://www.allrecipes.com/search?q=${encodeURIComponent(current.title)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-semibold text-tomato underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              🔎 See ratings on Allrecipes
            </a>
            {Math.abs(drag) > 50 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl" aria-hidden>
                {drag > 0 ? "😍" : "👎"}
              </div>
            ) : null}
          </Card>
          {flash ? (
            <p className="reaction-pop pointer-events-none absolute inset-x-0 -top-3 mx-auto w-fit rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background">
              {flash}
            </p>
          ) : null}
        </div>
      ) : (
        <Card className="py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🃏
          </p>
          <p className="mt-2 font-semibold">{dealing ? DEALING[line % DEALING.length] : "Out of ideas for now."}</p>
          {!dealing ? (
            <Button type="button" className="mt-3" onClick={() => void dealMore()}>
              Deal more ideas
            </Button>
          ) : null}
        </Card>
      )}

      {current ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={() => decide(false)}>
              👎 Nah
            </Button>
            <Button type="button" size="lg" onClick={() => decide(true)}>
              😍 Add it
            </Button>
          </div>
          <p className="text-center text-xs text-muted">
            Swipe right to add, left to pass. {queue.length > 1 ? `${queue.length - 1} more in the deck.` : ""}
            {dealing ? " Dealing more…" : ""}
          </p>
        </>
      ) : null}

      {recent.length ? (
        <Card>
          <h2 className="text-lg font-bold">Recently added</h2>
          <ul className="mt-2 space-y-1.5">
            {recent.map((r) => (
              <li key={r.id} className={cx("flex items-center gap-2", r.status === "failed" && "text-muted")}>
                <span aria-hidden>{r.emoji}</span>
                {r.status === "added" && r.slug ? (
                  <Link href={`/recipes/${r.slug}`} className="font-semibold underline">
                    {r.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{r.title}</span>
                )}
                <span className="ml-auto text-xs text-muted">
                  {r.status === "writing" ? "✍️ writing the recipe…" : r.status === "added" ? "✓ in your recipes" : "couldn't write it"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
