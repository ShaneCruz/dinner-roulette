import { redirect } from "next/navigation";
import { STARTER_RECIPES } from "@/data/starter-recipes";
import { getFamilySettings, requireParentSession } from "@/lib/session";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: "Set up your kitchen" };

export default async function SetupPage() {
  const session = await requireParentSession();
  const settings = await getFamilySettings();
  if (settings?.setupCompletedAt) redirect("/");

  const starters = STARTER_RECIPES.map((r) => ({
    slug: r.slug,
    title: r.title,
    kind: r.kind,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <SetupWizard
        starters={starters}
        signedInName={session.user.name}
        signedInEmail={session.user.email}
      />
    </main>
  );
}
