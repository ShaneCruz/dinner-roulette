import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai/claude";
import { requireParentMember } from "@/lib/session";
import { ImportForm } from "./import-form";

export const metadata = { title: "Add a recipe" };

export default async function ImportPage({ searchParams }: PageProps<"/recipes/import">) {
  const { acting } = await requireParentMember();
  const mode = (await searchParams).mode;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recipes" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Recipe box
      </Link>
      <PageHeader
        title="Add a recipe"
        subtitle="Snap your recipe card, drop in a PDF, paste a link, or just describe it."
      />
      {aiEnabled() ? (
        <ImportForm humor={acting.humorDial} initialMode={typeof mode === "string" ? mode : undefined} />
      ) : (
        <Card>
          <p className="font-semibold">AI import isn&apos;t turned on yet.</p>
          <p className="mt-1 text-sm text-muted">
            Add an <code>ANTHROPIC_API_KEY</code> environment variable in Vercel and redeploy. Meanwhile you can{" "}
            <Link href="/recipes/new" className="text-tomato underline">
              type a recipe in
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}
