import { Avatar, Card } from "@/components/ui";
import { faceFor, reasonLabel } from "@/lib/ratings/scale";

type Rating = { memberId: string; stars: number; reasons: string[]; note: string | null; date: string };
type Member = { id: string; name: string; avatarEmoji: string; avatarColor: string };

/** The family's verdict on one recipe: overall, per person, and why. */
export function RatingsSummary({ ratings, members }: { ratings: Rating[]; members: Member[] }) {
  if (!ratings.length) return null;
  const average = ratings.reduce((a, r) => a + r.stars, 0) / ratings.length;
  const latestByMember = new Map<string, Rating>();
  for (const r of ratings) if (!latestByMember.has(r.memberId)) latestByMember.set(r.memberId, r);
  const reasonCounts = new Map<string, number>();
  for (const r of ratings) for (const reason of r.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  const notes = ratings.filter((r) => r.note).slice(0, 3);
  const times = new Set(ratings.map((r) => r.date)).size;

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {faceFor(average).emoji}
        </span>
        <div>
          <h2 className="text-xl font-bold">The family verdict: {faceFor(average).label}</h2>
          <p className="text-sm text-muted">
            {ratings.length} {ratings.length === 1 ? "rating" : "ratings"} over {times} {times === 1 ? "dinner" : "dinners"}
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-3">
        {members
          .filter((m) => latestByMember.has(m.id))
          .map((m) => {
            const r = latestByMember.get(m.id)!;
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-full bg-surface-muted py-1 pl-1 pr-3">
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size="sm" />
                <span className="text-sm font-semibold">{m.name}</span>
                <span className="text-xl" title={faceFor(r.stars).label}>
                  {faceFor(r.stars).emoji}
                </span>
              </li>
            );
          })}
      </ul>
      {reasonCounts.size ? (
        <p className="mt-3 text-sm text-muted">
          {[...reasonCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => `${reasonLabel(reason)}${count > 1 ? ` ×${count}` : ""}`)
            .join(" · ")}
        </p>
      ) : null}
      {notes.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {notes.map((r, i) => (
            <li key={i}>
              <span className="font-semibold">{members.find((m) => m.id === r.memberId)?.name ?? "Someone"}:</span> “{r.note}”
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
