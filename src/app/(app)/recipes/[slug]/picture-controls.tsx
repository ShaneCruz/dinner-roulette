"use client";

import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/shrink-image";
import { findSourcePictureAction, removeRecipePictureAction, uploadRecipePhotoAction } from "../actions";

/** Add a photo the family took, fetch the source site's picture, or take the picture off. */
export function PictureControls({
  recipeId,
  hasPicture,
  hasOwnPhoto,
  canFetch,
  siteName,
}: {
  recipeId: string;
  hasPicture: boolean;
  hasOwnPhoto: boolean;
  /** Came from a web page and has no picture from it yet */
  canFetch: boolean;
  siteName: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (label: string, work: () => Promise<{ error: string } | void>) =>
    startTransition(async () => {
      setBusy(label);
      setError(null);
      try {
        const result = await work();
        if (result?.error) setError(result.error);
      } catch {
        setError("That didn't work. Check your signal and try again.");
      } finally {
        setBusy(null);
      }
    });

  const link = "text-sm font-semibold disabled:opacity-60";
  return (
    <div className="no-print space-y-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            run("Saving the photo…", async () => {
              const form = new FormData();
              form.set("photo", await shrinkImage(file, 1200));
              return uploadRecipePhotoAction(recipeId, form);
            });
          }}
        />
        <button type="button" disabled={pending} className={`${link} text-tomato`} onClick={() => input.current?.click()}>
          📷 {hasOwnPhoto ? "Change photo" : "Add your photo"}
        </button>
        {canFetch ? (
          <button
            type="button"
            disabled={pending}
            className={`${link} text-plum`}
            onClick={() => run("Fetching the picture…", () => findSourcePictureAction(recipeId))}
          >
            🖼️ Get the picture from {siteName ?? "the site"}
          </button>
        ) : null}
        {hasPicture ? (
          <button
            type="button"
            disabled={pending}
            className={`${link} text-muted`}
            onClick={() => run("Removing…", () => removeRecipePictureAction(recipeId))}
          >
            {hasOwnPhoto ? "Remove our photo" : "Remove picture"}
          </button>
        ) : null}
        {busy ? <span className="text-sm text-muted">{busy}</span> : null}
      </div>
      {error ? <p className="text-sm text-tomato-strong">{error}</p> : null}
    </div>
  );
}
