"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Tonight", icon: "🍽️", parentOnly: false },
  { href: "/plan", label: "Plan", icon: "🗓️", parentOnly: false },
  { href: "/grocery", label: "Groceries", icon: "🛒", parentOnly: false },
  { href: "/recipes", label: "Recipes", icon: "📖", parentOnly: false },
  { href: "/family", label: "Family", icon: "👨‍👩‍👧‍👦", parentOnly: false },
];

export function NavLinks({ isParent, variant }: { isParent: boolean; variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => isParent || !l.parentOnly);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (variant === "top") {
    return (
      <ul className="flex gap-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={cx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                isActive(l.href) ? "bg-tomato-soft text-tomato-strong" : "text-muted hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex">
      {links.map((l) => (
        <li key={l.href} className="flex-1">
          <Link
            href={l.href}
            className={cx(
              // Big enough to hit with a thumb, and clear of the home indicator.
              "flex min-h-14 flex-col items-center justify-center gap-1 py-3 text-xs font-semibold",
              isActive(l.href) ? "text-tomato-strong" : "text-muted",
            )}
          >
            <span className="text-xl" aria-hidden>
              {l.icon}
            </span>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
