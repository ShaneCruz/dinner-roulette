"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";
import { Wheel, type WheelItem } from "@/components/wheel";
import { say, type Tone } from "@/lib/copy";
import { CARDS } from "@/lib/fun/card-info";
import { CHAOS, pickChaos, pickWheelIndex, type ChaosKind } from "@/lib/fun/chaos";
import { saveSpinAction } from "./actions";

type Option = { id: string; title: string; slug: string; emoji: string; reason: string | null };

const CHAOS_ID = "chaos";

export function DinnerSpinner({
  date,
  options,
  chaosEnabled,
  spinnerName,
  tone,
  isParent,
  alreadySpun: spunBefore,
  respins: startingRespins,
  current,
  handPicked,
  shuffleHref,
}: {
  date: string;
  options: Option[];
  chaosEnabled: boolean;
  spinnerName: string;
  tone: Tone;
  isParent: boolean;
  alreadySpun: boolean;
  respins: number;
  current: string | null;
  handPicked: boolean;
  /** Deals a different set of dinners onto the wheel */
  shuffleHref: string | null;
}) {
  const [alreadySpun, setAlreadySpun] = useState(spunBefore);
  const [respins, setRespins] = useState(startingRespins);
  const [result, setResult] = useState<{ option: Option | null; chaos: ChaosKind | null } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spins, setSpins] = useState(0);

  const items: WheelItem[] = options.map((o) => ({ id: o.id, label: o.title, emoji: o.emoji }));
  if (chaosEnabled) items.push({ id: CHAOS_ID, label: "Chaos!", emoji: "🎲", special: true });
  const chaosIndex = chaosEnabled ? items.length - 1 : null;

  const needsRespin = alreadySpun && !isParent;
  const canSpin = !needsRespin || respins > 0;

  async function land(item: WheelItem) {
    const chaos = item.id === CHAOS_ID ? pickChaos() : null;
    const option = chaos
      ? chaos === "spinner_side"
        ? options[0]
        : null
      : (options.find((o) => o.id === item.id) ?? null);
    setResult({ option, chaos });
    setSaved(null);
    setError(null);
    setSpins((n) => n + 1);
    try {
      const response = await saveSpinAction({
        date,
        recipeId: option?.id ?? null,
        chaos,
        respin: needsRespin,
      });
      if ("error" in response) {
        setError(response.error);
        return;
      }
      if (needsRespin) setRespins((n) => n - 1);
      setAlreadySpun(true);
      setSaved(response.reason);
    } catch {
      setError("That spin didn't save. Reload and try again.");
    }
  }

  return (
    <div className="space-y-5">
      {handPicked && isParent && current ? (
        <p className="rounded-2xl bg-mustard-soft px-4 py-2 text-sm">
          Heads up: <span className="font-semibold">{current}</span> is already planned. Spinning replaces it.
        </p>
      ) : null}
      {needsRespin && !result ? (
        <p className="rounded-2xl bg-surface-muted px-4 py-2 text-sm">
          {respins > 0
            ? `The wheel already picked ${current ?? "tonight's dinner"}. Spinning again uses one ${CARDS.respin.emoji} Respin card (you have ${respins}).`
            : `The wheel already picked ${current ?? "tonight's dinner"}. Earn a ${CARDS.respin.emoji} Respin card to spin again.`}
        </p>
      ) : null}

      <Wheel
        items={items}
        disabled={!canSpin}
        pickIndex={() => pickWheelIndex(items.length, chaosIndex)}
        spinLabel={needsRespin ? `${CARDS.respin.emoji} Respin!` : result ? "Spin again" : "🎡 Spin!"}
        onResult={land}
      />

      {result ? (
        <Card className="border-mustard bg-mustard-soft text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-muted">{say("wheelLanded", tone, {}, spins)}</p>
          {result.chaos ? (
            <>
              <p className="mt-2 text-5xl" aria-hidden>
                {CHAOS[result.chaos].emoji}
              </p>
              <h2 className="mt-1 text-3xl font-bold">{CHAOS[result.chaos].label}!</h2>
              <p className="mt-1">{CHAOS[result.chaos].line}</p>
              {result.chaos === "spinner_side" && result.option ? (
                <p className="mt-2 text-sm">
                  Dinner is <span className="font-semibold">{result.option.title}</span>, and {spinnerName} picks the side.
                </p>
              ) : null}
            </>
          ) : result.option ? (
            <>
              <p className="mt-2 text-5xl" aria-hidden>
                {result.option.emoji}
              </p>
              <h2 className="mt-1 text-3xl font-bold">{result.option.title}</h2>
              {result.option.reason ? <p className="mt-1 text-sm text-muted">✨ {result.option.reason}</p> : null}
            </>
          ) : null}
          {saved ? <p className="mt-3 font-semibold text-basil">✓ It&apos;s on the plan.</p> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-tomato-strong">{error}</p> : null}
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm font-semibold">
            {result.option ? (
              <Link href={`/recipes/${result.option.slug}`} className="text-tomato underline">
                See the recipe
              </Link>
            ) : null}
            <Link href="/plan" className="text-tomato underline">
              Back to the plan
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">On the wheel</p>
          {shuffleHref && !result ? (
            <Link href={shuffleHref} replace scroll={false} className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold">
              🔀 Shuffle the options
            </Link>
          ) : null}
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {options.map((o) => (
            <li key={o.id}>
              {o.emoji} <span className="font-semibold">{o.title}</span>
              {o.reason ? <span className="text-muted"> · {o.reason}</span> : null}
            </li>
          ))}
          {chaosEnabled ? (
            <li className="text-muted">🎲 Chaos! (rare): parents&apos; choice, breakfast for dinner, or you pick the side</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
