import Link from "next/link";
import { Badge, Card, SpiceMeter } from "@/components/ui";
import { COOK_METHOD_LABELS, type CookMethod } from "@/lib/recipes/schema";
import type { RecipeSummary } from "@/lib/recipes/store";

const METHOD_EMOJI: Record<CookMethod, string> = {
  stovetop: "🍳",
  oven: "🔥",
  grill: "♨️",
  slow_cooker: "🍲",
  dutch_oven: "🫕",
  sheet_pan: "🥘",
  vitamix: "🌀",
  air_fryer: "💨",
  no_cook: "🥗",
};

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const handsOff = recipe.totalMinutes - recipe.activeMinutes >= 60;
  return (
    <Link href={`/recipes/${recipe.slug}`} className="group block">
      <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            {METHOD_EMOJI[recipe.method]}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight">{recipe.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{recipe.description}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone={recipe.activeMinutes <= 30 ? "basil" : "mustard"}>
            ⏱ {recipe.activeMinutes} min hands-on
          </Badge>
          {handsOff ? <Badge tone="plum">Hands-off {Math.round(recipe.totalMinutes / 60)}h</Badge> : null}
          <Badge>{COOK_METHOD_LABELS[recipe.method]}</Badge>
          {recipe.healthCategory === "healthy" ? <Badge tone="basil">Healthy</Badge> : null}
          {recipe.healthCategory === "comfort" ? <Badge tone="tomato">Comfort</Badge> : null}
          {recipe.status === "draft" ? <Badge tone="mustard">Draft</Badge> : null}
          {recipe.spiceLevel > 0 ? <SpiceMeter level={recipe.spiceLevel} className="text-xs" /> : null}
        </div>
      </Card>
    </Link>
  );
}
