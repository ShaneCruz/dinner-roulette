"use client";

import { useEffect, useState, useTransition } from "react";
import { CookPhotoButton } from "@/components/cook-photo-button";
import { Card } from "@/components/ui";
import { formatDay } from "@/lib/plan/week";
import { cookPhotoSrc } from "@/lib/recipes/picture";
import { deleteCookPhotoAction, makeCookPhotoMainAction } from "../actions";

type Make = { id: string; madeOn: string; who: string | null; memberId: string | null };

/** The dish as the family has made it, over time, newest first. Tap one to see it big. */
export function MadeGallery({
  recipeId,
  makes,
  actingId,
  isParent,
}: {
  recipeId: string;
  makes: Make[];
  actingId: string;
  isParent: boolean;
}) {
  const [open, setOpen] = useState<Make | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const act = (work: () => Promise<{ error: string } | void>, done: string) =>
    startTransition(async () => {
      try {
        const result = await work();
        setMessage(result?.error ?? done);
        if (!result?.error) setOpen(null);
      } catch {
        setMessage("That didn't work. Try again.");
      }
    });

  return (
    <Card className="no-print mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">📸 When we made it</h2>
          <p className="text-sm text-muted">
            {makes.length
              ? `${makes.length} ${makes.length === 1 ? "photo" : "photos"}, last on ${formatDay(makes[0].madeOn)}.`
              : "Snap it next time it's on the table, and it shows up here."}
          </p>
        </div>
        <CookPhotoButton recipeId={recipeId} />
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {makes.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {makes.map((make) => (
            <li key={make.id}>
              <button type="button" onClick={() => setOpen(make)} className="block w-full text-left">
                {/* eslint-disable-next-line @next/next/no-img-element -- the family's own photos, already small */}
                <img
                  src={cookPhotoSrc(make.id)}
                  alt={`As made on ${formatDay(make.madeOn)}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl bg-surface-muted object-cover"
                />
                <span className="mt-1 block text-xs text-muted">{formatDay(make.madeOn)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Photo from ${formatDay(open.madeOn, "long")}`}
            className="flex max-h-full w-full max-w-2xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the family's own photos, already small */}
            <img src={cookPhotoSrc(open.id)} alt="" className="max-h-[70vh] w-full rounded-2xl object-contain" />
            <div className="flex flex-wrap items-center gap-3 text-white">
              <p className="mr-auto font-semibold">
                {formatDay(open.madeOn, "long")}
                {open.who ? ` · ${open.who}` : ""}
              </p>
              {isParent ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => makeCookPhotoMainAction(open.id), "✓ That's the recipe's main photo now.")}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                >
                  Use as the main photo
                </button>
              ) : null}
              {isParent || open.memberId === actingId ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => deleteCookPhotoAction(open.id), "Photo removed.")}
                  className="rounded-full border border-white/50 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Delete
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(null)} className="rounded-full px-3 py-2 text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
