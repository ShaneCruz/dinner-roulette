"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, cx, inputClass } from "@/components/ui";
import { shrinkImage } from "@/lib/shrink-image";
import { importAvailability } from "../actions";

type Period = {
  label: string;
  startDate: string;
  endDate: string;
  presence: "home" | "away";
  note: string | null;
  sure: boolean;
  duplicate: boolean;
  keep: boolean;
};

const LOOKING = ["Reading the calendar…", "Finding every break…", "Counting the long weekends…", "Double-checking the dates…"];

function formatRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Upload a school calendar (Andover's PDF, a photo, or pasted dates) and
 * turn it into home/away dates after a parent checks them over.
 */
export function CalendarImport({ memberId, name, boarding }: { memberId: string; name: string; boarding: boolean }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setLine((l) => l + 1), 4000);
    return () => clearInterval(id);
  }, [busy]);

  async function read() {
    setBusy(true);
    setError(null);
    setLine(0);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", await shrinkImage(file));
      form.append("text", text);
      form.append("hint", hint);
      const response = await fetch(`/api/members/${memberId}/calendar`, { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        schoolYear?: string | null;
        periods?: Omit<Period, "keep">[];
      };
      if (!response.ok || !data.periods) {
        setError(data.error ?? "Couldn't read that calendar. Try again.");
        return;
      }
      setSchoolYear(data.schoolYear ?? null);
      setPeriods(data.periods.map((p) => ({ ...p, keep: !p.duplicate })));
    } catch {
      setError("Lost the connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<Period>) =>
    setPeriods((all) => all!.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">📅 Import a school calendar</p>
          <p className="text-sm text-muted">
            {boarding
              ? `Upload ${name}'s school calendar and every break and long weekend becomes "home for dinner".`
              : `Upload a school calendar to add trips and overnight programs.`}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Upload calendar
        </Button>
      </Card>
    );
  }

  if (done !== null) {
    return (
      <Card className="border-basil/40 bg-basil-soft">
        <p className="font-bold text-basil">
          ✓ Added {done} date {done === 1 ? "range" : "ranges"} to {name}&apos;s calendar.
        </p>
        <p className="mt-1 text-sm text-muted">The planner and grocery list now count {name} on those nights.</p>
      </Card>
    );
  }

  if (periods) {
    const kept = periods.filter((p) => p.keep);
    return (
      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Check the dates{schoolYear ? ` (${schoolYear})` : ""}</h2>
          <p className="text-sm text-muted">
            {boarding
              ? `These are the dinners ${name} is home for. Fix anything that's off, like travel days, then add them.`
              : `These are the nights ${name} is away. Fix anything that's off, then add them.`}
          </p>
        </div>
        {periods.length === 0 ? <p className="text-sm">No upcoming breaks found.</p> : null}
        <ul className="space-y-3">
          {periods.map((p, i) => (
            <li key={i} className={cx("space-y-2 rounded-2xl border p-3", p.keep ? "border-border" : "border-dashed border-border opacity-60")}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-basil"
                  checked={p.keep}
                  onChange={(e) => update(i, { keep: e.target.checked })}
                  aria-label={`Add ${p.label}`}
                />
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full bg-transparent font-bold outline-none"
                    value={p.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    aria-label="Name"
                  />
                  <p className="text-sm text-muted">
                    {p.presence === "home" ? "🏠 Home" : "✈️ Away"} {formatRange(p.startDate, p.endDate)}
                    {p.duplicate ? " · already on the calendar" : ""}
                    {!p.sure ? " · ⚠️ double-check" : ""}
                  </p>
                  {p.note ? <p className="text-xs text-muted">{p.note}</p> : null}
                </div>
              </div>
              {p.keep ? (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  <label className="text-xs font-semibold text-muted">
                    First dinner
                    <input type="date" className={cx(inputClass, "mt-1")} value={p.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Last dinner
                    <input type="date" className={cx(inputClass, "mt-1")} value={p.endDate} onChange={(e) => update(i, { endDate: e.target.value })} />
                  </label>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || kept.length === 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  const result = await importAvailability(
                    memberId,
                    kept.map((p) => ({
                      startDate: p.startDate,
                      endDate: p.endDate,
                      presence: p.presence,
                      label: p.label.trim() || (p.presence === "home" ? "Home" : "Away"),
                      tentative: false,
                      note: p.note?.slice(0, 200) ?? null,
                    })),
                  );
                  if (result && "error" in result) setError(result.error);
                  else setDone(result && "added" in result ? result.added : kept.length);
                } catch {
                  setError("That didn't save. Reload and try again.");
                }
              })
            }
          >
            {pending ? "Adding…" : `Add ${kept.length} to ${name}'s calendar`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPeriods(null)}>
            Start over
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">📅 Import {name}&apos;s school calendar</h2>
        <p className="text-sm text-muted">A PDF from the school website works best. A photo or pasted dates work too.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} className="w-full">
        {files.length ? `📎 ${files.map((f) => f.name).join(", ")}` : "📄 Choose the PDF or photo"}
      </Button>
      <label className="block text-sm font-semibold">
        …or paste the dates
        <textarea className={cx(inputClass, "mt-1 min-h-20")} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thanksgiving vacation: Nov 20 – Nov 29…" />
      </label>
      <label className="block text-sm font-semibold">
        Travel notes (optional)
        <textarea
          className={cx(inputClass, "mt-1 min-h-16")}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder={boarding ? "She flies home Friday nights, so her first dinner home is Saturday." : "Anything that changes the dates"}
        />
      </label>
      {error ? <p className="text-sm font-semibold text-tomato-strong">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy || (!files.length && text.trim().length < 20)} onClick={read}>
          {busy ? LOOKING[line % LOOKING.length] : "Read the calendar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
