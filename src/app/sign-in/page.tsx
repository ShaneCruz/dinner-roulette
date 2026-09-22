import { redirect } from "next/navigation";
import { authProviders } from "@/lib/auth";
import { getParentSession } from "@/lib/session";
import { SignInButtons } from "./sign-in-buttons";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getParentSession()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mb-4 text-7xl" aria-hidden>
          🎡
        </div>
        <h1 className="text-4xl font-bold">Cruz Meals</h1>
        <p className="mt-2 text-muted">Family dinners, decided.</p>
      </div>
      <SignInButtons google={authProviders.google} devLogin={authProviders.devLogin} />
      <p className="mt-6 text-center text-sm text-muted">
        Parents sign in once per device. Kids just tap their face after that.
      </p>
    </main>
  );
}
