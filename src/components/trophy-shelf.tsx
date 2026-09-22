import { Card, cx } from "@/components/ui";
import { computeBadges, type BadgeStats } from "@/lib/fun/badges";

/** Earned badges up top, the closest unearned ones below with progress. */
export function TrophyShelf({ stats, name, compact = false }: { stats: BadgeStats; name: string; compact?: boolean }) {
  const badges = computeBadges(stats);
  const earned = badges.filter((b) => b.earned);
  const next = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, compact ? 1 : 3);

  if (compact) {
    return (
      <Card className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            🏆 {name}&apos;s trophy shelf{stats.streak >= 2 ? ` · 🔥 ${stats.streak}-week streak` : ""}
          </p>
          <p className="text-2xl leading-tight" aria-label={earned.map((b) => b.name).join(", ") || "No badges yet"}>
            {earned.length ? earned.map((b) => b.emoji).join(" ") : <span className="text-sm text-muted">No badges yet. Rate a dinner to get the first one!</span>}
          </p>
        </div>
        {next[0] ? (
          <p className="text-sm text-muted">
            Next: {next[0].emoji} {next[0].name} ({next[0].how.toLowerCase()}
            {next[0].label ? `, ${next[0].label}` : ""})
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">🏆 Trophy shelf</h2>
        <p className="text-sm text-muted">
          {earned.length} of {badges.length} badges
          {stats.streak >= 1 ? ` · 🔥 rated ${stats.streak} week${stats.streak === 1 ? "" : "s"} in a row` : ""}
        </p>
      </div>
      {earned.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {earned.map((b) => (
            <li key={b.id} className="rounded-2xl bg-mustard-soft p-3 text-center" title={b.how}>
              <span className="block text-3xl" aria-hidden>
                {b.emoji}
              </span>
              <span className="block text-sm font-bold">{b.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No badges yet. Rating dinners is the fastest way to start.</p>
      )}
      {next.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-muted">Almost there</p>
          {next.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <span className="text-2xl grayscale" aria-hidden>
                {b.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{b.name}</span> · {b.how}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className={cx("h-full rounded-full bg-plum")} style={{ width: `${Math.round(b.progress * 100)}%` }} />
                </div>
              </div>
              {b.label ? <span className="shrink-0 text-xs text-muted">{b.label}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
