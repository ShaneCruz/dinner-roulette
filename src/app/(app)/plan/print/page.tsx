import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { loadWeekView } from "@/lib/plan/view";
import { NIGHT_TYPES, TIME_BUDGETS, formatDay, weekStartFor } from "@/lib/plan/week";
import { todayIn } from "@/lib/presence";
import { getActiveMembers, requireActingMember } from "@/lib/session";

export const metadata = { title: "Print plan" };

export default async function PrintPlanPage({ searchParams }: PageProps<"/plan/print">) {
  const { settings } = await requireActingMember();
  const requested = (await searchParams).week;
  const anchor =
    typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayIn(settings.timezone);
  const weekStart = weekStartFor(anchor, settings.weekStartsOn);
  const [view, members] = await Promise.all([loadWeekView(weekStart), getActiveMembers()]);
  const titles = new Map(view.options.map((o) => [o.id, o]));
  const names = new Map(members.map((m) => [m.id, m.name]));

  return (
    <div className="mx-auto max-w-3xl bg-surface p-6 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/plan?week=${weekStart}`} className="text-sm font-semibold text-muted">
          ← Back to the plan
        </Link>
        <PrintButton />
      </div>
      <header className="border-b-2 border-foreground pb-2">
        <h1 className="text-3xl font-bold">{settings.familyName}: dinners this week</h1>
        <p className="text-sm">
          {formatDay(view.dates[0])} – {formatDay(view.dates[6])}
        </p>
      </header>
      <table className="mt-4 w-full border-collapse text-sm">
        <tbody>
          {view.nights.map((night) => {
            const recipe = night.recipeId ? titles.get(night.recipeId) : null;
            const sides = night.sideRecipeIds.map((id) => titles.get(id)?.title).filter(Boolean);
            const cooking = night.nightType === "cook";
            return (
              <tr key={night.date} className="border-b border-border align-top">
                <th className="w-32 py-3 pr-3 text-left font-bold">{formatDay(night.date, "long")}</th>
                <td className="py-3">
                  {!cooking ? (
                    <span className="text-lg font-semibold">
                      {NIGHT_TYPES[night.nightType].emoji} {NIGHT_TYPES[night.nightType].label}
                    </span>
                  ) : recipe ? (
                    <>
                      <span className="text-lg font-semibold">{recipe.title}</span>
                      {sides.length ? <span> with {sides.join(" + ")}</span> : null}
                      <span className="block text-xs text-muted">
                        {recipe.activeMinutes} min hands-on
                        {recipe.totalMinutes - recipe.activeMinutes >= 60
                          ? ` · start ${Math.round(recipe.totalMinutes / 60)} hours before dinner`
                          : ""}
                        {" · "}
                        {TIME_BUDGETS[night.timeBudget].label} night
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">________________________</span>
                  )}
                  {night.status === "skipped" ? <span className="ml-2 text-xs">(skipped)</span> : null}
                </td>
                <td className="w-48 py-3 text-right text-xs text-muted">
                  {cooking ? night.eatingIds.map((id) => names.get(id)).filter(Boolean).join(", ") : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
