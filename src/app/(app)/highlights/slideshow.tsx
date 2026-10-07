"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDay } from "@/lib/plan/week";
import { cookPhotoSrc } from "@/lib/recipes/picture";
import type { Highlight } from "@/lib/recipes/cook-photos";

const SLIDE_SECONDS = 5;

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "🎉 First time making it!" or "3rd time making it" */
export function makeLabel(makeNumber: number | null | undefined): string | null {
  if (!makeNumber) return null;
  return makeNumber === 1 ? "🎉 First time making it!" : `${ordinal(makeNumber)} time making it`;
}

/** Every dish the family has made, as a grid by month, opening into a full-screen slideshow. */
export function Highlights({ photos }: { photos: Highlight[] }) {
  const [index, setIndex] = useState<number | null>(null);

  const months: { label: string; items: { photo: Highlight; index: number }[] }[] = [];
  photos.forEach((photo, i) => {
    const label = new Date(`${photo.madeOn}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
    const month = months[months.length - 1];
    if (month?.label === label) month.items.push({ photo, index: i });
    else months.push({ label, items: [{ photo, index: i }] });
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setIndex(0)}
        className="mb-6 w-full rounded-3xl bg-tomato px-6 py-4 text-lg font-bold text-white shadow-sm hover:opacity-90 sm:w-auto"
      >
        ▶ Play the slideshow
      </button>
      <div className="space-y-6">
        {months.map((month) => (
          <section key={month.label}>
            <h2 className="mb-2 text-lg font-bold">{month.label}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {month.items.map(({ photo, index: i }) => (
                <li key={photo.id}>
                  <button type="button" onClick={() => setIndex(i)} className="group block w-full text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the family's own photos, already small */}
                    <img
                      src={cookPhotoSrc(photo.id)}
                      alt={photo.title}
                      loading="lazy"
                      className="aspect-square w-full rounded-2xl bg-surface-muted object-cover transition group-hover:opacity-90"
                    />
                    <span className="mt-1 block truncate text-sm font-semibold">{photo.title}</span>
                    <span className="block text-xs text-muted">
                      {formatDay(photo.madeOn)}
                      {photo.makeNumber === 1 ? " · 🎉 first time" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {index !== null ? <Slideshow photos={photos} start={index} onClose={() => setIndex(null)} /> : null}
    </>
  );
}

/**
 * Full screen, one dish at a time: swipe or use the arrows, and it plays on
 * its own for showing friends. Black in light and dark mode alike, so its
 * colors are fixed rather than the theme's.
 */
function Slideshow({ photos, start, onClose }: { photos: Highlight[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [playing, setPlaying] = useState(start === 0);
  const touchX = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const photo = photos[index];

  const go = useCallback((step: number) => setIndex((i) => (i + step + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const id = setTimeout(() => go(1), SLIDE_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [playing, index, go, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    // No page scrolling behind it.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  // The next photo, fetched ahead so slides don't flash blank.
  const next = photos[(index + 1) % photos.length];

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Chef Highlights slideshow"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) {
          setPlaying(false);
          go(dx < 0 ? 1 : -1);
        }
      }}
    >
      <div className="flex items-center gap-2 p-3 text-sm">
        <span className="font-semibold text-white/70">
          {index + 1} / {photos.length}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => setPlaying(!playing)} className="rounded-full bg-white/15 px-4 py-2 font-semibold hover:bg-white/25">
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen?.())?.catch?.(() => {})}
          className="hidden rounded-full bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 sm:block"
        >
          ⛶ Full screen
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-4 py-2 font-semibold hover:bg-white/25" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- the family's own photos, already small */}
        <img key={photo.id} src={cookPhotoSrc(photo.id)} alt={photo.title} className="max-h-full max-w-full animate-[fadein_400ms_ease-out] rounded-2xl object-contain" />
        {/* eslint-disable-next-line @next/next/no-img-element -- preloading the next slide */}
        <img src={cookPhotoSrc(next.id)} alt="" className="hidden" />
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            go(-1);
          }}
          className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl hover:bg-white/25 sm:block"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            go(1);
          }}
          className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl hover:bg-white/25 sm:block"
          aria-label="Next"
        >
          ›
        </button>
      </div>

      <div className="space-y-1 p-5 pb-8 text-center">
        <Link href={`/recipes/${photo.slug}`} className="font-display text-2xl font-bold hover:underline sm:text-3xl">
          {photo.title}
        </Link>
        <p className="text-white/80">
          {formatDay(photo.madeOn, "long")}
          {photo.who ? ` · 📸 ${photo.who}` : ""}
        </p>
        <p className="flex flex-wrap justify-center gap-2 text-sm">
          {makeLabel(photo.makeNumber) ? (
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{makeLabel(photo.makeNumber)}</span>
          ) : null}
          {photo.stars !== null ? (
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              {"⭐".repeat(Math.round(photo.stars))} family rated it {photo.stars}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
