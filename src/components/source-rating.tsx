import type { SourceRating } from "@/lib/recipes/store";

export function formatCount(count: number): string {
  return count >= 10_000 ? `${Math.round(count / 1000)}k` : count.toLocaleString();
}

/** "⭐ 4.8 · 12,345 ratings on Allrecipes", linking to the original. */
export function SourceRatingBadge({ rating, url, compact = false }: { rating: SourceRating | null; url?: string | null; compact?: boolean }) {
  if (!rating || (!rating.rating && !rating.count)) return null;
  const text = compact
    ? `⭐ ${rating.rating ?? "?"}${rating.count ? ` (${formatCount(rating.count)})` : ""}`
    : `⭐ ${rating.rating ?? "?"}${rating.count ? ` · ${rating.count.toLocaleString()} ratings` : ""}${rating.site ? ` on ${rating.site}` : ""}`;
  const className = "inline-flex items-center rounded-full bg-mustard-soft px-2.5 py-0.5 text-xs font-semibold text-foreground";
  return url && !compact ? (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {text}
    </a>
  ) : (
    <span className={className}>{text}</span>
  );
}
