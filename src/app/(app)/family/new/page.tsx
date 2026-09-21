import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { defaultMember } from "@/lib/family";
import { getActiveMembers, requireParentMember } from "@/lib/session";
import { MemberEditor } from "../member-editors";

export const metadata = { title: "Add a person" };

export default async function NewMemberPage() {
  await requireParentMember();
  const count = (await getActiveMembers()).length;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/family" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Family
      </Link>
      <PageHeader title="Add a person" />
      <MemberEditor id={null} initial={defaultMember("kid", count)} canArchive={false} />
    </div>
  );
}
