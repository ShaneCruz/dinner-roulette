import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireParentMember } from "@/lib/session";
import { SendButtonSetup } from "./send-button-setup";

export const metadata = { title: "Send to Cruz Meals" };

export default async function SendButtonPage() {
  await requireParentMember();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/recipes/import" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Add a recipe
      </Link>
      <PageHeader
        title="“Send to Cruz Meals” button"
        subtitle="Allrecipes (and some other sites) block apps from reading their pages. This button runs in your own browser, so it works anywhere, and it brings the star rating and number of ratings along."
      />
      <SendButtonSetup />
      <Card className="space-y-2 text-sm">
        <p className="font-bold">Using it</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>Find a recipe on Allrecipes (sort by rating; thousands of 5-star reviews is the sweet spot).</li>
          <li>Open your bookmarks and tap <strong>Send to Cruz Meals</strong>.</li>
          <li>The recipe opens here, gets read and gets the family&apos;s versions added. Check it over and save.</li>
        </ol>
        <p className="text-muted">No button handy? Screenshots of the recipe work too, and the rating is picked up from them.</p>
      </Card>
    </div>
  );
}
