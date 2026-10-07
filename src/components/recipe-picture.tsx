"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/**
 * A recipe's picture. Pictures from recipe sites are linked rather than
 * copied, so one can disappear; then this quietly shows nothing (or the
 * fallback) instead of a broken image.
 */
export function RecipePicture({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) return <>{fallback}</>;
  return (
    // Plain img: these come from any recipe site, and the family's own are already small.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      // Some recipe sites refuse pictures shown on other sites when told where they're shown.
      referrerPolicy="no-referrer"
      onError={() => setBroken(src)}
      className={cx("object-cover", className)}
    />
  );
}
