"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Avatar, Badge, Button, Card, SpiceMeter, cx, inputClass } from "@/components/ui";
import { say, type Tone } from "@/lib/copy";
import { cuisineEmoji } from "@/lib/cuisine-emoji";
import { CARDS } from "@/lib/fun/card-info";
import { tallyVotes } from "@/lib/fun/deck";
import type { SessionCard } from "@/lib/fun/session";
import {
  buildWeekAction,
  chefsPickAction,
  giveCardAction,
  startOverAction,
  undoVetoAction,
  vetoAction,
  voteAction,
} from "./actions";

type Player = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: "parent" | "kid";
  title: string | null;
  tone: Tone;
  eating: boolean;
};
type Vote = { memberId: string; recipeId: string; vote: number };
type Veto = { memberId: string; recipeId: string };
type Hand = { memberId: string; vetoesLeft: number; powerUps: { double_down: number; respin: number; chefs_pick: number } };
type Tab = "swipe" | "results" | "cards";

const HEALTH: Record<SessionCard["healthCategory"], { label: string; tone: "basil" | "neutral" | "mustard" }> = {
  healthy: { label: "🥦 Healthy", tone: "basil" },
  balanced: { label: "⚖️ Balanced", tone: "neutral" },
  comfort: { label: "🛋️ Comfort food", tone: "mustard" },
};

export function SessionGame({
  weekStart,
  openNights,
  cards,
  players,
  initialVotes,
  initialVetoes,
  initialHands,
  actingId,
  isParent,
  mains,
  upcomingNights,
}: {
  weekStart: string;
  openNights: string[];
  cards: SessionCard[];
  players: Player[];
  initialVotes: Vote[];
  initialVetoes: Veto[];
  initialHands: Record<string, Hand>;
  actingId: string;
  isParent: boolean;
  mains: { id: string; title: string }[];
  upcomingNights: { date: string; label: string }[];
}) {
  const [tab, setTab] = useState<Tab>("swipe");
  const [votes, setVotes] = useState(initialVotes);
  const [vetoes, setVetoes] = useState(initialVetoes);
  const [hands, setHands] = useState(initialHands);
  const [playerId, setPlayerId] = useState<string | null>(isParent ? null : actingId);
  const [error, setError] = useState<string | null>(null);

  const player = players.find((p) => p.id === playerId) ?? null;
  const votedBy = (memberId: string) => new Set(votes.filter((v) => v.memberId === memberId).map((v) => v.recipeId));

  return (
    <div className="space-y-4">
      <div className="flex rounded-full bg-surface-muted p-1" role="tablist">
        {(
          [
            ["swipe", "🗳️ Swipe"],
            ["results", "🏆 Results"],
            ["cards", "🃏 Cards"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "flex-1 rounded-full py-2 text-sm font-bold transition",
              tab === key ? "bg-surface text-foreground shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-2 text-sm font-semibold text-tomato-strong">
          {error}
        </p>
      ) : null}

      {tab === "swipe" ? (
        cards.length === 0 ? null : player ? (
          <SwipeRound
            key={player.id}
            weekStart={weekStart}
            player={player}
            cards={cards}
            votes={votes}
            hand={hands[player.id]}
            canSwitch={isParent}
            onVote={(recipeId, vote) =>
              setVotes((all) => [...all.filter((v) => !(v.memberId === player.id && v.recipeId === recipeId)), { memberId: player.id, recipeId, vote }])
            }
            onUnvote={(recipeId) => setVotes((all) => all.filter((v) => !(v.memberId === player.id && v.recipeId === recipeId)))}
            onVeto={(recipeId) => {
              setVetoes((all) => [...all, { memberId: player.id, recipeId }]);
              setHands((all) => ({ ...all, [player.id]: { ...all[player.id], vetoesLeft: all[player.id].vetoesLeft - 1 } }));
            }}
            onDoubleDown={() =>
              setHands((all) => ({
                ...all,
                [player.id]: {
                  ...all[player.id],
                  powerUps: { ...all[player.id].powerUps, double_down: all[player.id].powerUps.double_down - 1 },
                },
              }))
            }
            onReset={() => setVotes((all) => all.filter((v) => v.memberId !== player.id))}
            onDone={() => setPlayerId(isParent ? null : actingId)}
            onError={setError}
          />
        ) : (
          <Lineup
            players={players}
            total={cards.length}
            votedCount={(id) => votedBy(id).size}
            onPick={(id) => {
              setError(null);
              setPlayerId(id);
            }}
            onSeeResults={() => setTab("results")}
            openNights={openNights}
          />
        )
      ) : null}

      {tab === "results" ? (
        <Results
          weekStart={weekStart}
          cards={cards}
          players={players}
          votes={votes}
          vetoes={vetoes}
          isParent={isParent}
          onUndoVeto={(veto) => {
            setVetoes((all) => all.filter((v) => !(v.memberId === veto.memberId && v.recipeId === veto.recipeId)));
            setHands((all) => ({ ...all, [veto.memberId]: { ...all[veto.memberId], vetoesLeft: all[veto.memberId].vetoesLeft + 1 } }));
          }}
          onError={setError}
        />
      ) : null}

      {tab === "cards" ? (
        <CardsTab
          players={players}
          hands={hands}
          isParent={isParent}
          actingId={actingId}
          mains={mains}
          upcomingNights={upcomingNights}
          onGranted={(memberId, card) =>
            setHands((all) => ({
              ...all,
              [memberId]: { ...all[memberId], powerUps: { ...all[memberId].powerUps, [card]: all[memberId].powerUps[card] + 1 } },
            }))
          }
          onChefsPick={(memberId) =>
            setHands((all) => ({
              ...all,
              [memberId]: { ...all[memberId], powerUps: { ...all[memberId].powerUps, chefs_pick: all[memberId].powerUps.chefs_pick - 1 } },
            }))
          }
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function Lineup({
  players,
  total,
  votedCount,
  onPick,
  onSeeResults,
  openNights,
}: {
  players: Player[];
  total: number;
  votedCount: (id: string) => number;
  onPick: (id: string) => void;
  onSeeResults: () => void;
  openNights: string[];
}) {
  const eating = players.filter((p) => p.eating);
  const away = players.filter((p) => !p.eating);
  const allDone = eating.length > 0 && eating.every((p) => votedCount(p.id) >= total);
  const row = (p: Player) => {
    const done = votedCount(p.id);
    return (
      <li key={p.id}>
        <button
          type="button"
          onClick={() => onPick(p.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-tomato"
        >
          <Avatar emoji={p.emoji} color={p.color} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{p.name}</span>
            {p.title ? <span className="block truncate text-xs text-muted">{p.title}</span> : null}
          </span>
          <span className={cx("shrink-0 text-sm font-semibold", done >= total ? "text-basil" : "text-muted")}>
            {done >= total ? "✓ Done" : done ? `${done}/${total}` : "Tap to play"}
          </span>
        </button>
      </li>
    );
  };
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Who&apos;s swiping?</h2>
        <p className="text-sm text-muted">
          {total} dinners to judge
          {openNights.length ? ` for ${openNights.length} open night${openNights.length === 1 ? "" : "s"}` : ""}. Tap your
          face, swipe, then pass the phone.
        </p>
      </div>
      <ul className="space-y-2">{eating.map(row)}</ul>
      {away.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-muted">Away that week ({away.map((p) => p.name).join(", ")})</summary>
          <ul className="mt-2 space-y-2">{away.map(row)}</ul>
        </details>
      ) : null}
      {allDone ? (
        <Button type="button" onClick={onSeeResults} className="w-full">
          🏆 Everyone voted! See the results
        </Button>
      ) : null}
    </Card>
  );
}

function SwipeRound({
  weekStart,
  player,
  cards,
  votes,
  hand,
  canSwitch,
  onVote,
  onUnvote,
  onVeto,
  onDoubleDown,
  onReset,
  onDone,
  onError,
}: {
  weekStart: string;
  player: Player;
  cards: SessionCard[];
  votes: Vote[];
  hand: Hand | undefined;
  canSwitch: boolean;
  onVote: (recipeId: string, vote: number) => void;
  onUnvote: (recipeId: string) => void;
  onVeto: (recipeId: string) => void;
  onDoubleDown: () => void;
  onReset: () => void;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const mine = new Map(votes.filter((v) => v.memberId === player.id).map((v) => [v.recipeId, v.vote]));
  const [history, setHistory] = useState<string[]>([]);
  const [reaction, setReaction] = useState<string | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [, startTransition] = useTransition();
  const seed = useRef(0);

  const current = cards.find((c) => !mine.has(c.id)) ?? null;
  const doneCount = cards.length - cards.filter((c) => !mine.has(c.id)).length;
  const doubleDowns = hand?.powerUps.double_down ?? 0;
  const vetoesLeft = hand?.vetoesLeft ?? 0;

  function react(key: "loveReact" | "yesReact" | "nopeReact" | "vetoReact") {
    seed.current += 1;
    setReaction(say(key, player.tone, {}, seed.current + doneCount));
    window.setTimeout(() => setReaction(null), 1200);
  }

  function vote(kind: "nope" | "yes" | "love") {
    if (!current) return;
    const useDouble = kind === "love" && doubled && doubleDowns > 0;
    const value = kind === "nope" ? -1 : kind === "yes" ? 1 : useDouble ? 4 : 2;
    onError(null);
    onVote(current.id, value);
    setHistory((h) => [...h, current.id]);
    react(kind === "nope" ? "nopeReact" : kind === "yes" ? "yesReact" : "loveReact");
    if (useDouble) {
      onDoubleDown();
      setDoubled(false);
    }
    const recipeId = current.id;
    startTransition(async () => {
      try {
        const result = await voteAction(weekStart, player.id, recipeId, useDouble ? "doubled" : kind);
        if ("error" in result) {
          onError(result.error);
          onUnvote(recipeId);
        }
      } catch {
        onError("Lost connection. That vote may not have saved.");
        onUnvote(recipeId);
      }
    });
  }

  function veto() {
    if (!current || vetoesLeft < 1) return;
    const recipeId = current.id;
    if (!window.confirm(`Veto ${current.title} for the whole week? ${player.name} only gets one.`)) return;
    onError(null);
    onVeto(recipeId);
    onVote(recipeId, -1);
    setHistory((h) => [...h, recipeId]);
    react("vetoReact");
    startTransition(async () => {
      try {
        const result = await vetoAction(weekStart, player.id, recipeId);
        if ("error" in result) onError(result.error);
      } catch {
        onError("Lost connection. The veto may not have saved.");
      }
    });
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    onUnvote(last);
  }

  // Swipe gestures: right = yes, left = nope, up = love.
  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    const d = drag;
    start.current = null;
    setDrag(null);
    if (!d) return;
    if (d.y < -90 && Math.abs(d.y) > Math.abs(d.x)) vote("love");
    else if (d.x > 90) vote("yes");
    else if (d.x < -90) vote("nope");
  }

  if (!current) {
    const loved = cards.filter((c) => (mine.get(c.id) ?? 0) >= 2);
    return (
      <Card className="space-y-4 text-center">
        <Avatar emoji={player.emoji} color={player.color} size="lg" className="mx-auto animate-bounce" />
        <p className="text-2xl font-bold">{say("passPhone", player.tone, {}, doneCount + player.name.length)}</p>
        {loved.length ? (
          <p className="text-sm text-muted">
            {player.name} loved: {loved.map((c) => c.title).join(", ")}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          {canSwitch ? (
            <Button type="button" onClick={onDone}>
              👉 Next player
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onReset();
              setHistory([]);
              startTransition(async () => {
                await startOverAction(weekStart, player.id);
              });
            }}
          >
            Redo my votes
          </Button>
        </div>
      </Card>
    );
  }

  const tilt = drag ? Math.max(-15, Math.min(15, drag.x / 10)) : 0;
  const hint = !drag ? null : drag.y < -60 && Math.abs(drag.y) > Math.abs(drag.x) ? "😍" : drag.x > 60 ? "👍" : drag.x < -60 ? "👎" : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar emoji={player.emoji} color={player.color} />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{doneCount === 0 ? say("swipeStart", player.tone, { name: player.name }) : player.name}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted" aria-label={`${doneCount} of ${cards.length} done`}>
            <div className="h-full rounded-full bg-tomato transition-all" style={{ width: `${(doneCount / cards.length) * 100}%` }} />
          </div>
        </div>
        {canSwitch ? (
          <button type="button" onClick={onDone} className="shrink-0 text-sm font-semibold text-muted">
            Switch
          </button>
        ) : null}
      </div>

      <div className="relative">
        <Card
          key={current.id}
          className="swipe-card relative touch-none select-none space-y-3 p-6"
          style={{
            transform: drag ? `translate(${drag.x}px, ${Math.min(drag.y, 0)}px) rotate(${tilt}deg)` : undefined,
            transition: drag ? "none" : "transform 200ms",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag(null);
          }}
        >
          <div className="text-6xl" aria-hidden>
            {cuisineEmoji(`${current.title} ${current.cuisine}`)}
          </div>
          <h2 className="text-2xl font-bold leading-tight">{current.title}</h2>
          {current.description ? <p className="text-muted">{current.description}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            {current.isNew ? <Badge tone="plum">🆕 Never made it</Badge> : null}
            <Badge tone={HEALTH[current.healthCategory].tone}>{HEALTH[current.healthCategory].label}</Badge>
            <Badge>⏱️ {current.activeMinutes} min{current.totalMinutes > current.activeMinutes + 30 ? ` (${Math.round(current.totalMinutes / 60)}h total)` : ""}</Badge>
            {current.spiceLevel > 0 ? <SpiceMeter level={current.spiceLevel} /> : null}
          </div>
          <Link href={`/recipes/${current.slug}`} target="_blank" className="inline-block text-sm font-semibold text-tomato underline">
            See the recipe
          </Link>
          {hint ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl" aria-hidden>
              {hint}
            </div>
          ) : null}
        </Card>
        {reaction ? (
          <p className="pointer-events-none absolute inset-x-0 -top-3 mx-auto w-fit rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background shadow-lg reaction-pop">
            {reaction}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={() => vote("nope")} aria-label="Nope">
          👎 Nope
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => vote("yes")} aria-label="Yes">
          👍 Yes
        </Button>
        <Button type="button" size="lg" onClick={() => vote("love")} aria-label={doubled ? "Love, doubled" : "Love"}>
          😍 {doubled ? "×2" : "Love"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={undo} disabled={!history.length} className="font-semibold text-muted disabled:opacity-40">
          ↩ Undo
        </button>
        <div className="flex flex-wrap gap-2">
          {doubleDowns > 0 ? (
            <button
              type="button"
              aria-pressed={doubled}
              onClick={() => setDoubled(!doubled)}
              className={cx(
                "rounded-full border px-3 py-1.5 font-semibold",
                doubled ? "border-plum bg-plum-soft text-plum" : "border-border",
              )}
            >
              {CARDS.double_down.emoji} Double Down ({doubleDowns})
            </button>
          ) : null}
          {player.role === "kid" ? (
            <button
              type="button"
              onClick={veto}
              disabled={vetoesLeft < 1}
              className="rounded-full border border-tomato px-3 py-1.5 font-semibold text-tomato-strong disabled:border-border disabled:text-muted"
            >
              {CARDS.veto.emoji} {vetoesLeft > 0 ? "Veto" : "Veto used"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-center text-xs text-muted">Tip: swipe right for yes, left for nope, up for love.</p>
    </div>
  );
}

function Results({
  weekStart,
  cards,
  players,
  votes,
  vetoes,
  isParent,
  onUndoVeto,
  onError,
}: {
  weekStart: string;
  cards: SessionCard[];
  players: Player[];
  votes: Vote[];
  vetoes: Veto[];
  isParent: boolean;
  onUndoVeto: (veto: Veto) => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [built, setBuilt] = useState<number | null>(null);
  const tally = tallyVotes(
    cards.map((c) => c.id),
    votes,
    vetoes,
  );
  const byId = new Map(cards.map((c) => [c.id, c]));
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? "Someone";
  const voters = new Set(votes.map((v) => v.memberId));
  const waiting = players.filter((p) => p.eating && !voters.has(p.id));

  return (
    <div className="space-y-4">
      {waiting.length ? (
        <p className="text-sm text-muted">Still waiting on: {waiting.map((p) => p.name).join(", ")}</p>
      ) : null}
      <Card>
        <h2 className="text-xl font-bold">The leaderboard</h2>
        {votes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No votes yet. Head to Swipe to start.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {tally.map((t, i) => {
              const card = byId.get(t.recipeId);
              if (!card) return null;
              const lovers = votes.filter((v) => v.recipeId === t.recipeId && v.vote >= 2).map((v) => name(v.memberId));
              const vetoed = t.vetoedBy.length > 0;
              return (
                <li
                  key={t.recipeId}
                  className={cx("flex items-start gap-3 rounded-2xl p-2", vetoed ? "opacity-60" : i < 3 && t.score > 0 ? "bg-mustard-soft" : "")}
                >
                  <span className="w-7 shrink-0 text-center text-lg font-bold">
                    {vetoed ? "🚫" : i === 0 && t.score > 0 ? "🥇" : i === 1 && t.score > 0 ? "🥈" : i === 2 && t.score > 0 ? "🥉" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("font-semibold", vetoed && "line-through")}>{card.title}</p>
                    <p className="text-xs text-muted">
                      😍 {t.loves} · 👍 {t.yeses} · 👎 {t.nopes}
                      {lovers.length ? ` · loved by ${lovers.join(", ")}` : ""}
                    </p>
                    {vetoed ? (
                      <p className="text-xs font-semibold text-tomato-strong">
                        Vetoed by {t.vetoedBy.map(name).join(", ")}
                        {isParent ? (
                          <button
                            type="button"
                            className="ml-2 underline"
                            onClick={() =>
                              t.vetoedBy.forEach((memberId) => {
                                onUndoVeto({ memberId, recipeId: t.recipeId });
                                startTransition(async () => {
                                  await undoVetoAction(weekStart, memberId, t.recipeId);
                                });
                              })
                            }
                          >
                            Overrule
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      {isParent ? (
        <Card className="space-y-2 border-basil/40 bg-basil-soft">
          <p className="font-bold">Turn the votes into a plan</p>
          <p className="text-sm text-muted">
            Fills the open nights (and redoes the planner&apos;s own picks) using everyone&apos;s votes, turns, prep time and
            the rest. Dinners you chose by hand stay put. Vetoed dinners stay off.
          </p>
          {built !== null ? (
            <p className="font-semibold text-basil">
              ✓ Planned {built} night{built === 1 ? "" : "s"}.{" "}
              <Link href="/plan" className="underline">
                See the plan →
              </Link>
            </p>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  onError(null);
                  try {
                    const result = await buildWeekAction(weekStart);
                    if ("error" in result) onError(result.error);
                    else setBuilt(result.filled);
                  } catch {
                    onError("That didn't work. Reload and try again.");
                  }
                })
              }
            >
              {pending ? "Planning…" : "✨ Build the week from these votes"}
            </Button>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function CardsTab({
  players,
  hands,
  isParent,
  actingId,
  mains,
  upcomingNights,
  onGranted,
  onChefsPick,
  onError,
}: {
  players: Player[];
  hands: Record<string, Hand>;
  isParent: boolean;
  actingId: string;
  mains: { id: string; title: string }[];
  upcomingNights: { date: string; label: string }[];
  onGranted: (memberId: string, card: "double_down" | "respin" | "chefs_pick") => void;
  onChefsPick: (memberId: string) => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [giveTo, setGiveTo] = useState(players.find((p) => p.role === "kid")?.id ?? players[0]?.id ?? "");
  const [giveCard, setGiveCard] = useState<"double_down" | "respin" | "chefs_pick">("respin");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [chef, setChef] = useState<{ memberId: string; date: string; recipeId: string } | null>(null);

  const visible = isParent ? players : players.filter((p) => p.id === actingId);

  return (
    <div className="space-y-4">
      {notice ? <p className="rounded-2xl bg-basil-soft px-4 py-2 text-sm font-semibold text-basil">{notice}</p> : null}
      <Card>
        <h2 className="text-xl font-bold">Hands</h2>
        <ul className="mt-3 space-y-3">
          {visible.map((p) => {
            const hand = hands[p.id];
            const chips = [
              p.role === "kid" ? `${CARDS.veto.emoji} ${hand?.vetoesLeft ? "Veto ready" : "Veto used"}` : null,
              hand?.powerUps.double_down ? `${CARDS.double_down.emoji} Double Down ×${hand.powerUps.double_down}` : null,
              hand?.powerUps.respin ? `${CARDS.respin.emoji} Respin ×${hand.powerUps.respin}` : null,
              hand?.powerUps.chefs_pick ? `${CARDS.chefs_pick.emoji} Chef's Pick ×${hand.powerUps.chefs_pick}` : null,
            ].filter(Boolean);
            return (
              <li key={p.id} className="flex items-start gap-3">
                <Avatar emoji={p.emoji} color={p.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-muted">{chips.length ? chips.join(" · ") : "No cards yet"}</p>
                  {hand?.powerUps.chefs_pick ? (
                    <button
                      type="button"
                      className="mt-1 text-sm font-semibold text-tomato underline"
                      onClick={() => setChef({ memberId: p.id, date: upcomingNights[0]?.date ?? "", recipeId: "" })}
                    >
                      Play Chef&apos;s Pick
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {chef ? (
        <Card className="space-y-3 border-mustard bg-mustard-soft">
          <p className="font-bold">
            {CARDS.chefs_pick.emoji} {players.find((p) => p.id === chef.memberId)?.name}&apos;s Chef&apos;s Pick
          </p>
          <label className="block text-sm font-semibold">
            Which night?
            <select className={cx(inputClass, "mt-1")} value={chef.date} onChange={(e) => setChef({ ...chef, date: e.target.value })}>
              {upcomingNights.map((n) => (
                <option key={n.date} value={n.date}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Which dinner?
            <select className={cx(inputClass, "mt-1")} value={chef.recipeId} onChange={(e) => setChef({ ...chef, recipeId: e.target.value })}>
              <option value="">Choose…</option>
              {mains.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending || !chef.recipeId || !chef.date}
              onClick={() =>
                startTransition(async () => {
                  onError(null);
                  try {
                    const result = await chefsPickAction(chef.memberId, chef.date, chef.recipeId);
                    if ("error" in result) onError(result.error);
                    else {
                      onChefsPick(chef.memberId);
                      setNotice(`👨‍🍳 Done! ${mains.find((m) => m.id === chef.recipeId)?.title} is on the plan.`);
                      setChef(null);
                    }
                  } catch {
                    onError("That didn't save. Reload and try again.");
                  }
                })
              }
            >
              Play it
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChef(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {isParent ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Hand out a card</h2>
          <p className="text-sm text-muted">Reward good behavior, a great rating streak, or emptying the dishwasher without being asked.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              To
              <select className={cx(inputClass, "mt-1")} value={giveTo} onChange={(e) => setGiveTo(e.target.value)}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Card
              <select
                className={cx(inputClass, "mt-1")}
                value={giveCard}
                onChange={(e) => setGiveCard(e.target.value as typeof giveCard)}
              >
                {(["respin", "double_down", "chefs_pick"] as const).map((c) => (
                  <option key={c} value={c}>
                    {CARDS[c].emoji} {CARDS[c].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold">
            For (optional)
            <input
              className={cx(inputClass, "mt-1")}
              value={reason}
              maxLength={120}
              placeholder="Rated every dinner this week"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            type="button"
            disabled={pending || !giveTo}
            onClick={() =>
              startTransition(async () => {
                onError(null);
                try {
                  const result = await giveCardAction(giveTo, giveCard, reason);
                  if ("error" in result) onError(result.error);
                  else {
                    onGranted(giveTo, giveCard);
                    setReason("");
                    setNotice(`${CARDS[giveCard].emoji} ${CARDS[giveCard].label} given to ${players.find((p) => p.id === giveTo)?.name}!`);
                  }
                } catch {
                  onError("That didn't save. Reload and try again.");
                }
              })
            }
          >
            🎁 Give card
          </Button>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-bold">What the cards do</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {Object.values(CARDS).map((c) => (
            <li key={c.label}>
              <span className="font-semibold">
                {c.emoji} {c.label}:
              </span>{" "}
              {c.blurb}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
