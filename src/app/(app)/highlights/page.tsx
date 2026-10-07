import Link from "next/link";
import { CookPhotoButton } from "@/components/cook-photo-button";
import { Card, PageHeader, cx } from "@/components/ui";
import { db } from "@/db";
import { formatDay } from "@/lib/plan/week";
import { todayIn } from "@/lib/presence";
import { cookingStats, dishesFrom, loadHighlights, madeDinners, type MadeDinner } from "@/lib/recipes/cook-photos";
import { cookPhotoSrc } from "@/lib/recipes/picture";
import { requireActingMember } from "@/lib/session";
import { Highlights } from "./slideshow";

export const metadata = { title: "Chef Highlights" };

type View = "photos" | "dinners" | "dishes" | "new";

/**
 * Everything the family has cooked: the numbers, each opening its list
 * (with a way to add the photo a dinner's missing), and every photo as a
 * slideshow to show off.
 */
export default async function HighlightsPage({ searchParams }: PageProps<"/highlights">) {
  const { settings } = await requireActingMember();
  const show = (await searchParams).show;
  const view: View = show === "dinners" || show === "dishes" || show === "new" ? show : "photos";
  const [photos, dinners] = await Promise.all([loadHighlights(db), madeDinners(db)]);
  const stats = cookingStats(dinners);
  const month = todayIn(settings.timezone).slice(0, 7);
  const newThisMonth = dinners.filter((d) => d.firstTime && d.date.startsWith(month));
  const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long" });

  const tiles: { view: View; value: number; label: string; emoji: string }[] = [
    { view: "dinners", value: stats.dinners, label: stats.dinners === 1 ? "dinner cooked" : "dinners cooked", emoji: "🍳" },
    { view: "dishes", value: stats.dishes, label: stats.dishes === 1 ? "different dish" : "different dishes", emoji: "📖" },
    { view: "new", value: newThisMonth.length, label: `new in ${monthName}`, emoji: "🎉" },
    { view: "photos", value: stats.photos, label: stats.photos === 1 ? "photo" : "photos", emoji: "📸" },
  ];

  return (
    <div>
      <PageHeader
        title="✨ Chef Highlights"
        subtitle={stats.since ? `Everything cooked since ${formatDay(stats.since, "long")}.` : "Everything this kitchen has turned out."}
      />

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.view}>
            <Link
              href={t.view === "photos" ? "/highlights" : `/highlights?show=${t.view}`}
              aria-current={view === t.view ? "page" : undefined}
              className="block h-full"
            >
              <Card
                className={cx(
                  "h-full text-center transition hover:shadow-md",
                  view === t.view && "border-tomato ring-2 ring-tomato/30",
                )}
              >
                <p className="text-3xl font-bold">
                  <span aria-hidden>{t.emoji}</span> {t.value}
                </p>
                <p className="text-sm text-muted">{t.label}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {view === "dinners" ? (
        <DinnerList title="Every dinner cooked" dinners={dinners} empty="Nothing marked made yet. Tap “✓ We made it” or 📸 on Tonight." />
      ) : view === "new" ? (
        <DinnerList
          title={`New dishes in ${monthName}`}
          dinners={newThisMonth}
          empty={`Nothing new yet in ${monthName}. Discover has ideas when you're ready.`}
        />
      ) : view === "dishes" ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Every dish made, most-made first</h2>
          <ul className="space-y-2">
            {dishesFrom(dinners).map((dish) => (
              <li key={dish.recipeId}>
                <Card className="flex items-center gap-3 p-3">
                  <Thumb photoId={dish.latestPhotoId} alt={dish.title} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/recipes/${dish.slug}`} className="font-semibold hover:underline">
                      {dish.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {dish.times === 1
                        ? `Made ${formatDay(dish.lastDate)}`
                        : `Made ${dish.times} times · first ${formatDay(dish.firstDate)}, last ${formatDay(dish.lastDate)}`}
                      {dish.photos ? ` · 📸 ${dish.photos}` : ""}
                    </p>
                  </div>
                  {!dish.photos ? (
                    <CookPhotoButton recipeId={dish.recipeId} mealId={dish.lastMealId} label="📸 Add a photo" />
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : photos.length ? (
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

/** Dinners, newest first, each with its photo or a way to add one dated that night. */
function DinnerList({ title, dinners, empty }: { title: string; dinners: MadeDinner[]; empty: string }) {
  const missing = dinners.filter((d) => !d.photoIds.length).length;
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mb-3 text-sm text-muted">
        {missing ? `${missing} without a photo. Took one? Add it and it's dated that night.` : dinners.length ? "Every one has a photo. 📸" : ""}
      </p>
      {dinners.length ? (
        <ul className="space-y-2">
          {dinners.map((d) => (
            <li key={`${d.date}|${d.recipeId}`}>
              <Card className="flex items-center gap-3 p-3">
                <Thumb photoId={d.photoIds[0] ?? null} alt={d.title} />
                <div className="min-w-0 flex-1">
                  <Link href={`/recipes/${d.slug}`} className="font-semibold hover:underline">
                    {d.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatDay(d.date, "long")}
                    {d.firstTime ? " · 🎉 first time" : ""}
                    {d.photoIds.length > 1 ? ` · 📸 ${d.photoIds.length}` : ""}
                  </p>
                </div>
                {!d.photoIds.length ? <CookPhotoButton recipeId={d.recipeId} mealId={d.mealId} label="📸 Add a photo" /> : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-muted">{empty}</p>
      )}
    </section>
  );
}

function Thumb({ photoId, alt }: { photoId: string | null; alt: string }) {
  return photoId ? (
    // eslint-disable-next-line @next/next/no-img-element -- the family's own photos, already small
    <img src={cookPhotoSrc(photoId)} alt={alt} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
  ) : (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-2xl" aria-hidden>
      🍽️
    </span>
  );
}
