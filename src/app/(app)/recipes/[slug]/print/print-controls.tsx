"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PrintControls({ slug, servings }: { slug: string; servings: number }) {
  const router = useRouter();
  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-3">
      <Link href={`/recipes/${slug}`} className="text-sm font-semibold text-muted">
        ← Back
      </Link>
      <label className="ml-auto flex items-center gap-2 text-sm">
        Servings
        <select
          className="rounded-xl border border-border bg-surface px-2 py-1"
          value={servings}
          onChange={(e) => router.replace(`/recipes/${slug}/print?servings=${e.target.value}`)}
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" onClick={() => window.print()}>
        🖨️ Print
      </Button>
    </div>
  );
}
