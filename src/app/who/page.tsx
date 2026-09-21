import { say } from "@/lib/copy";
import { getActiveMembers, requireFamily } from "@/lib/session";
import { MemberPicker } from "./member-picker";

export const metadata = { title: "Who's hungry?" };

export default async function WhoPage() {
  const { settings } = await requireFamily();
  const members = await getActiveMembers();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted">
        {settings.familyName}
      </p>
      <h1 className="mb-10 mt-2 text-center text-4xl font-bold sm:text-5xl">
        {say("whoIsHere", "goofball")}
      </h1>
      <MemberPicker
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          emoji: m.avatarEmoji,
          color: m.avatarColor,
          chefTitle: m.chefTitle,
          hasPin: Boolean(m.pinHash),
          humorDial: m.humorDial,
        }))}
      />
    </main>
  );
}
