import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { aiEnabled } from "@/lib/ai/claude";
import { pendingIdeas, recentAdditions } from "@/lib/recipes/ideas";
import { requireParentMember } from "@/lib/session";
import { DiscoverDeck } from "./discover-deck";

export const metadata = { title: "Discover dinners" };

// Writing a batch of ideas (and the recipes for yeses) takes a little while.
export const maxDuration = 300;

export default async function DiscoverPage() {
  await requireParentMember();
  const [ideas, recent] = await Promise.all([pendingIdeas(db), recentAdditions(db)]);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/recipes" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Recipes
      </Link>
      <PageHeader title="Discover dinners 💘" subtitle="Swipe right on anything your family would eat. We'll write the recipe and add it." />
      {aiEnabled() ? (
        <DiscoverDeck
          initialIdeas={ideas.map((i) => ({
            id: i.id, title: i.title, description: i.description, emoji: i.emoji, cuisine: i.cuisine,
            activeMinutes: i.activeMinutes, totalMinutes: i.totalMinutes, healthCategory: i.healthCategory,
            spiceLevel: i.spiceLevel, kidAppeal: i.kidAppeal, twistOn: i.twistOn,
          }))}
          recent={recent}
        />
      ) : (
        <Card>Discover needs AI. Add ANTHROPIC_API_KEY to turn it on.</Card>
      )}
    </div>
  );
}
