import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireActingMember } from "@/lib/session";

export const metadata = { title: "How it works" };

type Section = { emoji: string; title: string; body: string; link?: { href: string; label: string } };

const EVERYONE: Section[] = [
  {
    emoji: "⭐",
    title: "Rate every dinner",
    body: "After dinner, tap a face and pick a reason. It takes ten seconds and it's the single most useful thing anyone does here: ratings decide what gets suggested, what comes back sooner, and what quietly disappears.",
    link: { href: "/history", label: "Dinners waiting to be rated" },
  },
  {
    emoji: "🗳️",
    title: "Swipe in the Sunday session",
    body: "Once a week the family passes the phone around and swipes 👎, 👍 or 😍 on about a dozen dinners. Kids get one 🚫 veto a week. Then the week plans itself from the votes.",
    link: { href: "/session", label: "Open the Sunday session" },
  },
  {
    emoji: "🎡",
    title: "Spin when nobody can decide",
    body: "Any night without a plan can go to the wheel, which only offers dinners that actually fit that night. Shuffle deals different options, and there's a rare chaos slice.",
    link: { href: "/plan", label: "Go to the plan" },
  },
];

const PARENTS: Section[] = [
  {
    emoji: "🗓️",
    title: "Autopilot plans next week",
    body: "Friday morning the open nights fill themselves, around who's home, each night's time budget, ratings, the weather and whose turn it is. Anything you picked by hand stays. You get a notification; change whatever you like.",
    link: { href: "/plan", label: "This week's plan" },
  },
  {
    emoji: "🛒",
    title: "The grocery list builds itself",
    body: "Every planned dinner adds its ingredients, scaled to who's eating and sorted by aisle. It opens in the store with no signal, and two people can split it and see each other's check-offs.",
    link: { href: "/grocery", label: "Grocery list" },
  },
  {
    emoji: "👩‍🍳",
    title: "Cooking mode",
    body: "One step at a time, with the ingredients that step needs, timers that keep running between steps, and the screen kept awake. Mild versions and extra heat are called out before you start.",
  },
  {
    emoji: "📖",
    title: "Growing the recipe box",
    body: "Add recipes from a photo, PDF, link or pasted text. Discover deals new family-friendly ideas to swipe on. For Allrecipes, set up the “Send to Cruz Meals” bookmark, which brings the star rating along.",
    link: { href: "/recipes/import", label: "Add a recipe" },
  },
  {
    emoji: "✨",
    title: "Recipes that learn",
    body: "When ratings mention a problem (too spicy, too dry, too much work), the app drafts a fix and shows exactly what would change. You accept, dismiss, or undo it later. You can also ask for a change yourself on any recipe.",
  },
  {
    emoji: "🔔",
    title: "Reminders",
    body: "Thaw the meat the night before, start cooking in time to eat at your dinner hour, rate it afterwards, and a nudge when next week is planned. Each phone turns its own on.",
    link: { href: "/settings", label: "Settings" },
  },
  {
    emoji: "🛵",
    title: "Takeout nights",
    body: "Keep your regular spots with their menus, everyone's usual order and how each person feels about the place. Spin to choose, then copy the order or call it in.",
    link: { href: "/takeout", label: "Takeout" },
  },
  {
    emoji: "🤖",
    title: "What the AI costs",
    body: "Only some features use AI: adding recipes, Discover, side ideas, nutrition, tweaks and restaurant menus. There's a weekly budget (start: $10) and everything pauses when it runs out. Planning, groceries, wheels and ratings never use AI.",
    link: { href: "/settings", label: "See this week's spending" },
  },
];

const KIDS: Section[] = [
  {
    emoji: "🏆",
    title: "Badges and streaks",
    body: "Rating dinners, swiping, spinning and playing cards all earn badges. Rate dinners several weeks running and you get a streak.",
    link: { href: "/family", label: "Your trophy shelf" },
  },
  {
    emoji: "🃏",
    title: "Cards",
    body: "One 🚫 veto every week kills a dinner you can't stand. Parents hand out ⏫ Double Down (your 😍 counts twice), 🔄 Respin and 👨‍🍳 Chef's Pick (you choose dinner for a night).",
    link: { href: "/session", label: "See your cards" },
  },
];

export default async function HelpPage() {
  const { acting, settings } = await requireActingMember();
  const isParent = acting.role === "parent";
  const sections = isParent ? [...EVERYONE, ...PARENTS] : [...EVERYONE, ...KIDS];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="How Cruz Meals works"
        subtitle={
          isParent
            ? `Dinner for ${settings.familyName}, planned around who's home and how much time you've got.`
            : "Your part is small: rate dinners, swipe on Sundays, and use your veto wisely."
        }
      />
      <Card className="bg-basil-soft">
        <p className="font-bold">The short version</p>
        <p className="mt-1 text-sm">
          The week gets planned (by autopilot on Friday, or by the family on Sunday) → the grocery list builds itself →
          cooking mode walks you through dinner → everyone rates it → next week&apos;s suggestions get better.
        </p>
      </Card>
      <div className="space-y-3">
        {sections.map((section) => (
          <Card key={section.title} className="space-y-1.5">
            <h2 className="text-lg font-bold">
              <span aria-hidden>{section.emoji}</span> {section.title}
            </h2>
            <p className="text-muted">{section.body}</p>
            {section.link ? (
              <Link href={section.link.href} className="inline-block text-sm font-semibold text-tomato underline">
                {section.link.label} →
              </Link>
            ) : null}
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted">
        Something looks wrong, or you want it to work differently? Tell Shane, and he&apos;ll get it changed.
      </p>
    </div>
  );
}
