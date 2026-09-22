"use client";

import { useRef, useState } from "react";
import { Button, cx } from "@/components/ui";

export type WheelItem = { id: string; label: string; emoji?: string; special?: boolean };

const COLORS = ["#e0492f", "#f0ad2b", "#2f8a4f", "#7a4bb5", "#e8743b", "#3b82c4", "#c2417a", "#5aa05a"];
const SPIN_MS = 5200;

/**
 * A big spin-the-wheel. The result is chosen up front (so it's fair and
 * testable), then the wheel animates to land on it: several fast turns,
 * a long slow-down, a ticking sound, and confetti.
 */
export function Wheel({
  items,
  onResult,
  disabled = false,
  pickIndex,
  spinLabel = "Spin!",
  sound = true,
}: {
  items: WheelItem[];
  onResult: (item: WheelItem) => void;
  disabled?: boolean;
  /** Override the random pick (tests, or a weighted choice made by the caller) */
  pickIndex?: () => number;
  spinLabel?: string;
  sound?: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [duration, setDuration] = useState(SPIN_MS);
  const target = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const n = Math.max(items.length, 1);
  const slice = 360 / n;
  const radius = 150;

  function tick(context: AudioContext, at: number) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.08, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.03);
  }

  function spin() {
    if (spinning || items.length < 2) return;
    const index = pickIndex ? pickIndex() : Math.floor(Math.random() * items.length);
    target.current = index;
    // Land the chosen slice's middle under the pointer at the top, with a
    // little wobble so it doesn't always stop dead center.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spinFor = reduceMotion ? 1200 : SPIN_MS;
    setDuration(spinFor);
    const wobble = (Math.random() - 0.5) * slice * 0.6;
    const sliceCenter = index * slice + slice / 2;
    const turns = reduceMotion ? 1 : 6;
    const current = ((rotation % 360) + 360) % 360;
    const needed = (360 - sliceCenter - current + wobble + 720) % 360;
    setRotation(rotation + turns * 360 + needed);
    setSpinning(true);

    if (sound) {
      try {
        audio.current ??= new AudioContext();
        const context = audio.current;
        // Ticks that slow down along with the wheel.
        const seconds = spinFor / 1000;
        for (let t = 0; t < 1; t += 0.035) {
          const eased = 1 - Math.pow(1 - t, 3);
          if (Math.random() < 0.85) tick(context, context.currentTime + eased * seconds);
        }
      } catch {
        // No audio available; the wheel still spins.
      }
    }
  }

  function finished() {
    if (!spinning || target.current === null) return;
    setSpinning(false);
    setConfetti((c) => c + 1);
    onResult(items[target.current]);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative aspect-square w-full" style={{ maxWidth: radius * 2 + 20 }}>
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-4xl drop-shadow"
          aria-hidden
          style={{ lineHeight: 1 }}
        >
          ▼
        </div>
        <svg
          viewBox={`-${radius + 10} -${radius + 10} ${radius * 2 + 20} ${radius * 2 + 20}`}
          className="h-full w-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${duration}ms cubic-bezier(0.12, 0.7, 0.1, 1)`
              : "none",
          }}
          onTransitionEnd={finished}
          role="img"
          aria-label={`Wheel with ${items.map((i) => i.label).join(", ")}`}
        >
          <circle r={radius + 6} fill="var(--surface)" stroke="var(--border)" strokeWidth="4" />
          {items.map((item, i) => {
            const a0 = ((i * slice - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * slice - 90) * Math.PI) / 180;
            const large = slice > 180 ? 1 : 0;
            const path =
              n === 1
                ? `M 0 ${-radius} A ${radius} ${radius} 0 1 1 -0.01 ${-radius} Z`
                : `M 0 0 L ${radius * Math.cos(a0)} ${radius * Math.sin(a0)} A ${radius} ${radius} 0 ${large} 1 ${radius * Math.cos(a1)} ${radius * Math.sin(a1)} Z`;
            const mid = i * slice + slice / 2;
            const label = item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label;
            return (
              <g key={item.id}>
                <path d={path} fill={item.special ? "#2a1f16" : COLORS[i % COLORS.length]} stroke="#fff8ef" strokeWidth="2" />
                <g transform={`rotate(${mid}) translate(0 ${-radius * 0.58}) rotate(90)`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={n > 8 || label.length > 13 ? 11 : 13}
                    fontWeight={700}
                    style={{ fontFamily: "var(--font-nunito)" }}
                    transform="rotate(-90)"
                  >
                    {item.emoji ? `${item.emoji} ` : ""}
                    {label}
                  </text>
                </g>
              </g>
            );
          })}
          <circle r={22} fill="var(--surface)" stroke="var(--border)" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="22">
            🎡
          </text>
        </svg>
        {confetti > 0 ? <Confetti key={confetti} /> : null}
      </div>
      <Button type="button" size="lg" onClick={spin} disabled={disabled || spinning || items.length < 2} className="min-w-44">
        {spinning ? "Spinning…" : spinLabel}
      </Button>
      {items.length < 2 ? <p className="text-sm text-muted">Add at least two options to spin.</p> : null}
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {pieces.map((i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const distance = 120 + ((i * 37) % 80);
        return (
          <span
            key={i}
            className={cx("confetti-piece absolute left-1/2 top-1/2 block h-2.5 w-1.5 rounded-sm")}
            style={
              {
                background: COLORS[i % COLORS.length],
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance}px`,
                "--rot": `${(i * 73) % 360}deg`,
                animationDelay: `${(i % 5) * 20}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
