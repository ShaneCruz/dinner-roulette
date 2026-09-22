"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import type { Tone } from "@/lib/copy";

type Mode = "photo" | "pdf" | "link" | "text" | "describe" | "surprise";

const MODES: { id: Mode; label: string; emoji: string; hint: string }[] = [
  { id: "photo", label: "Photo", emoji: "📷", hint: "Recipe card, cookbook page, or screenshot. Several pages are fine." },
  { id: "pdf", label: "PDF", emoji: "📄", hint: "A saved or printed recipe, up to 4 MB." },
  { id: "link", label: "Link", emoji: "🔗", hint: "Paste a recipe website address." },
  { id: "text", label: "Paste", emoji: "📋", hint: "Paste or type the recipe, even rough notes like “2 lb beef, a can of beans…”." },
  { id: "describe", label: "Describe it", emoji: "✍️", hint: "Tell me the dinner you want and I'll write the recipe." },
  { id: "surprise", label: "Surprise us", emoji: "🎲", hint: "A new dinner that's a twist on one your family already likes." },
];

const WAITING: Record<Tone, string[]> = {
  goofball: [
    "Squinting at the handwriting…",
    "Asking the tomatoes to hold still…",
    "Counting teaspoons. Carefully. So carefully.",
    "Translating Grandma's “a pinch of this”…",
    "Teaching the recipe to behave…",
  ],
  dry: [
    "Reading the recipe…",
    "Measuring everything twice…",
    "Adding the mild and no-beef versions…",
    "Matching ingredients to your grocery list…",
    "Almost there. Recipes are wordy.",
  ],
};

/** Shrinks a phone photo so uploads stay small and fast. */
async function shrinkImage(file: File, maxEdge = 2000): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ImportForm({ humor, initialMode }: { humor: Tone; initialMode?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(
    MODES.some((m) => m.id === initialMode) ? (initialMode as Mode) : "photo",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [tweaks, setTweaks] = useState("");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setLine((l) => l + 1), 3500);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);

  async function pickFiles(list: FileList | null) {
    if (!list?.length) return;
    const picked = [...list];
    const prepared = mode === "photo" ? await Promise.all(picked.map((f) => shrinkImage(f))) : picked.slice(0, 1);
    const next = mode === "photo" ? [...files, ...prepared].slice(0, 6) : prepared;
    setFiles(next);
    setPreviews(mode === "photo" ? next.map((f) => URL.createObjectURL(f)) : []);
    setError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFiles([]);
    setPreviews([]);
    setError(null);
  }

  const ready =
    mode === "photo" || mode === "pdf"
      ? files.length > 0
      : mode === "link"
        ? url.trim().length > 8
        : mode === "surprise"
          ? true
          : text.trim().length > 2;

  async function submit() {
    setBusy(true);
    setError(null);
    setLine(0);
    const form = new FormData();
    form.set("mode", mode);
    files.forEach((f) => form.append("files", f));
    form.set("url", url);
    form.set("text", text);
    form.set("tweaks", tweaks);
    try {
      const response = await fetch("/api/recipes/import", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!response.ok || !data.slug) {
        setError(data.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/recipes/${data.slug}/edit?imported=1`);
    } catch {
      setError("Lost the connection. Check your signal and try again.");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Card className="py-12 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-mustard-soft border-t-tomato" aria-hidden />
        <p className="mt-5 text-xl font-bold">{WAITING[humor][line % WAITING[humor].length]}</p>
        <p className="mt-2 text-sm text-muted">This usually takes 30 to 90 seconds. Keep this page open.</p>
      </Card>
    );
  }

  const current = MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="tablist" aria-label="How to add it">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => switchMode(m.id)}
            className={cx(
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm font-semibold transition",
              mode === m.id ? "border-tomato bg-tomato-soft text-tomato-strong" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            <span className="text-2xl" aria-hidden>
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <p className="text-sm text-muted">{current.hint}</p>

        {mode === "photo" || mode === "pdf" ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={mode === "photo" ? "image/*" : "application/pdf"}
              multiple={mode === "photo"}
              onChange={(e) => {
                void pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {previews.length ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove page ${i + 1}`}
                      onClick={() => {
                        const next = files.filter((_, j) => j !== i);
                        setFiles(next);
                        setPreviews(next.map((f) => URL.createObjectURL(f)));
                      }}
                      className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/60 text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {mode === "pdf" && files[0] ? <p className="mb-3 font-semibold">📄 {files[0].name}</p> : null}
            <Button type="button" variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
              {mode === "photo" ? (files.length ? "+ Add another page" : "📷 Take or choose a photo") : files.length ? "Choose a different PDF" : "📄 Choose a PDF"}
            </Button>
          </div>
        ) : null}

        {mode === "link" ? (
          <input
            className={inputClass}
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/best-chili"
            aria-label="Recipe link"
          />
        ) : null}

        {mode === "text" || mode === "describe" ? (
          <textarea
            className={inputClass}
            rows={mode === "text" ? 10 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "text"
                ? "Jamie's chili\n2 lb ground beef\n2 cans kidney beans\n1 packet McCormick chili seasoning\n…"
                : "Something like chicken souvlaki but in the slow cooker"
            }
            aria-label={mode === "text" ? "Recipe text" : "What you'd like"}
          />
        ) : null}

        {mode === "photo" || mode === "pdf" || mode === "link" || mode === "text" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">How does your family make it differently? (optional)</span>
            <textarea
              className={inputClass}
              rows={2}
              value={tweaks}
              onChange={(e) => setTweaks(e.target.value)}
              placeholder="We add more tomatoes and sauce but keep the same beef. We skip the wine."
            />
          </label>
        ) : null}

        {mode === "surprise" ? (
          <p className="rounded-2xl bg-plum-soft px-4 py-3 text-sm">
            I&apos;ll look at what your family likes and invent one new dinner that&apos;s a small twist on a favorite. You
            can check it over before it joins the recipe box.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
            {error}
          </p>
        ) : null}

        <Button type="button" size="lg" className="w-full" disabled={!ready} onClick={submit}>
          {mode === "describe" ? "✨ Write the recipe" : mode === "surprise" ? "🎲 Surprise us" : "✨ Turn it into a recipe"}
        </Button>
      </Card>

      <p className="text-center text-sm text-muted">
        Prefer to type it yourself?{" "}
        <Link href="/recipes/new" className="text-tomato underline">
          Start from a blank recipe
        </Link>
      </p>
    </div>
  );
}
