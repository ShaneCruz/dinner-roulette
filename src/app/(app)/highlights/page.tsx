import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { formatDay } from "@/lib/plan/week";
import { cookingStats, loadHighlights } from "@/lib/recipes/cook-photos";
import { requireActingMember } from "@/lib/session";
import { Highlights } from "./slideshow";

export const metadata = { title: "Chef Highlights" };

/** Everything the family has cooked and photographed, to scroll through and show off. */
export default async function HighlightsPage() {
  await requireActingMember();
  const [photos, stats] = await Promise.all([loadHighlights(db), cookingStats(db)]);
  const firstTimes = photos.filter((p) => p.makeNumber === 1).length;

  return (
    <div>
      <PageHeader
        title="✨ Chef Highlights"
        subtitle={stats.since ? `Everything cooked since ${formatDay(stats.since, "long")}.` : "Everything this kitchen has turned out."}
      />

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: stats.dinners, label: stats.dinners === 1 ? "dinner cooked" : "dinners cooked", emoji: "🍳" },
          { value: stats.dishes, label: stats.dishes === 1 ? "different dish" : "different dishes", emoji: "📖" },
          { value: firstTimes, label: firstTimes === 1 ? "first try" : "first tries", emoji: "🎉" },
          { value: stats.photos, label: stats.photos === 1 ? "photo" : "photos", emoji: "📸" },
        ].map((s) => (
          <li key={s.label}>
            <Card className="h-full text-center">
              <p className="text-3xl font-bold">
                <span aria-hidden>{s.emoji}</span> {s.value}
              </p>
              <p className="text-sm text-muted">{s.label}</p>
            </Card>
          </li>
        ))}
      </ul>

      {photos.length ? (
        <Highlights photos={photos} />
      ) : (
        <Card className="py-10 text-center">
          <p className="text-4xl" aria-hidden>
            📸
          </p>
          <p className="mt-2 text-lg font-bold">No photos yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Tap <strong>📸 Snap it</strong> on Tonight when dinner hits the table, and every dish you make starts piling up here.
          </p>
          <Link href="/" className="mt-4 inline-block font-semibold text-tomato underline">
            Go to Tonight
          </Link>
        </Card>
      )}
    </div>
  );
}
