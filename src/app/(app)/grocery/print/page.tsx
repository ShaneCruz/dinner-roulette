import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { db } from "@/db";
import { formatGroceryAmount } from "@/lib/grocery/build";
import { grocerySnapshot } from "@/lib/grocery/store";
import { findWeekPlan } from "@/lib/plan/store";
import { formatDay, weekDates, weekStartFor } from "@/lib/plan/week";
import { todayIn } from "@/lib/presence";
import { STORE_SECTIONS, STORE_SECTION_LABELS } from "@/lib/recipes/schema";
import { requireActingMember } from "@/lib/session";

export const metadata = { title: "Print grocery list" };

export default async function PrintGroceryPage({ searchParams }: PageProps<"/grocery/print">) {
  const { settings } = await requireActingMember();
  const requested = (await searchParams).week;
  const anchor =
    typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayIn(settings.timezone);
  const weekStart = weekStartFor(anchor, settings.weekStartsOn);
  const dates = weekDates(weekStart);
  const plan = await findWeekPlan(db, weekStart);
  if (!plan) notFound();
  const { items } = await grocerySnapshot(db, plan.id);

  const needed = items.filter((i) => !i.isStale && !i.checked);
  const toBuy = needed.filter((i) => !i.isStaple);
  const staples = needed.filter((i) => i.isStaple);
  const sections = STORE_SECTIONS.map((section) => ({
    section,
    items: toBuy.filter((i) => i.section === section),
  })).filter((s) => s.items.length);

  return (
    <div className="mx-auto max-w-3xl bg-surface p-6 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/grocery?week=${weekStart}`} className="text-sm font-semibold text-muted">
          ← Back to the list
        </Link>
        <PrintButton />
      </div>
      <header className="border-b-2 border-foreground pb-2">
        <h1 className="text-3xl font-bold">Grocery list</h1>
        <p className="text-sm">
          {formatDay(dates[0])} – {formatDay(dates[6])} · {toBuy.length} items
        </p>
      </header>
      <div className="mt-4 columns-2 gap-8 text-sm">
        {sections.map(({ section, items: sectionItems }) => (
          <section key={section} className="mb-4 break-inside-avoid">
            <h2 className="mb-1 border-b border-border text-base font-bold">{STORE_SECTION_LABELS[section]}</h2>
            <ul className="space-y-0.5">
              {sectionItems.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span aria-hidden>☐</span>
                  <span>
                    {formatGroceryAmount(item) ? <strong>{formatGroceryAmount(item)} </strong> : null}
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {staples.length ? (
          <section className="mb-4 break-inside-avoid">
            <h2 className="mb-1 border-b border-border text-base font-bold">Check you have</h2>
            <p className="text-xs">{staples.map((s) => s.name).join(", ")}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
