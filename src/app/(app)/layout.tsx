import Link from "next/link";
import { Avatar } from "@/components/ui";
import { requireActingMember } from "@/lib/session";
import { switchMember } from "../who/actions";
import { NavLinks } from "./nav-links";
import { Welcome } from "@/components/welcome";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { settings, acting } = await requireActingMember();
  const isParent = acting.role === "parent";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span aria-hidden>🎡</span>
            <span className="hidden sm:inline">{settings.familyName}</span>
          </Link>
          <nav className="hidden flex-1 sm:block" aria-label="Main">
            <NavLinks isParent={isParent} variant="top" />
          </nav>
          {isParent ? (
            <Link
              href="/settings"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-surface-muted"
              aria-label="Settings"
              title="Settings"
            >
              ⚙️
            </Link>
          ) : null}
          <form action={switchMember} className={isParent ? "" : "ml-auto"}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-surface-muted"
              title="Switch person"
            >
              <Avatar emoji={acting.avatarEmoji} color={acting.avatarColor} size="sm" />
              <span className="text-sm font-semibold">{acting.name}</span>
              <span className="text-xs text-muted" aria-hidden>
                ⇄
              </span>
              <span className="sr-only">Switch person</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-12">{children}</main>
      {acting.welcomedAt ? null : <Welcome role={acting.role} name={acting.name} />}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <NavLinks isParent={isParent} variant="bottom" />
      </nav>
    </div>
  );
}
