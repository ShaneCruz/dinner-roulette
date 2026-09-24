import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { weekStartFor } from "@/lib/plan/week";
import { todayIn } from "@/lib/presence";
import { requireActingMember } from "@/lib/session";
import { loadEngineInputs } from "@/lib/suggest/load";
import { inAPinch } from "@/lib/suggest/in-a-pinch";
import { CookTonight } from "./cook-tonight";

export const metadata = { title: "In a pinch" };

/**
 * "What can I make tonight with a quick stop at the store?" Everything here
 * is sorted by how little you'd have to buy, then by how fast it cooks.
 */
export default async function QuickPage({ searchParams }: PageProps<"/quick">) {
  const { settings, acting } = await requireActingMember();
  const today = todayIn(settings.timezone);
  const minutes = Number((await searchParams).minutes);
  const maxMinutes = [20, 35, 60].includes(minutes) ? minutes : 35;

  const weekStart = weekStartFor(today, settings.weekStartsOn);
  const { context, nights } = await loadEngineInputs(db, weekStart, { weather: false });
  const tonight = nights.find((n) => n.date === today) ?? {
    date: today,
    eaterIds: context.members.map((m) => m.id),
    budget: "quick" as const,
  };
  const picks = inAPinch(tonight, context, { maxMinutes });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="⚡ In a pinch"
        subtitle="Dinner tonight, with the shortest trip to the store. Fewest things to buy first."
      />

      <div className="mb-5 flex flex-wrap gap-2" aria-label="How long you have">
        {[20, 35, 60].map((m) => (
          <Link
            key={m}
            href={`/quick?minutes=${m}`}
            className={
              m === maxMinutes
                ? "rounded-full border border-tomato bg-tomato-soft px-4 py-1.5 text-sm font-semibold text-tomato-strong"
                : "rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted"
            }
          >
            {m} min or less
          </Link>
        ))}
      </div>

      {picks.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl" aria-hidden>
            🕐
          </p>
          <p className="mt-2 font-semibold">Nothing that fast in the cookbook yet.</p>
          <p className="text-sm text-muted">
            Try a longer time above, or{" "}
            <Link href="/recipes/discover" className="font-semibold text-tomato underline">
              swipe through some quick dinner ideas
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {picks.map(({ recipe, buy, reasons }) => (
            <li key={recipe.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/recipes/${recipe.slug}`} className="text-lg font-bold underline-offset-2 hover:underline">
                    {recipe.title}
                  </Link>
                  <Badge tone={recipe.totalMinutes <= 20 ? "basil" : "neutral"}>{recipe.totalMinutes} min</Badge>
                </div>

                {buy.length === 0 ? (
                  <p className="text-sm font-semibold text-basil">🎉 You probably have everything already.</p>
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold">Grab {buy.length}:</span>{" "}
                    <span className="text-muted">{buy.join(", ")}</span>
                  </p>
                )}

                {reasons.length ? <p className="text-xs text-muted">{reasons[0]}</p> : null}

                {acting.role === "parent" ? <CookTonight recipeId={recipe.id} date={today} title={recipe.title} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-xs text-muted">
        Counts leave out salt, oil, butter, spices and the like, so the number is what you&apos;d actually put in the
        basket. It still assumes the cupboard is stocked.
      </p>
    </div>
  );
}
