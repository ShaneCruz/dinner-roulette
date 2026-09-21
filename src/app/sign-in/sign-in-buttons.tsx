"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

// Dev-only accounts share one password; DEV_LOGIN is refused in production.
const DEV_PASSWORD = "dinner-roulette-dev";

export function SignInButtons({ google, devLogin }: { google: boolean; devLogin: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (error) {
      setError(error.message ?? "Google sign-in failed.");
      setBusy(false);
    }
  }

  async function devSignIn(formData: FormData) {
    setBusy(true);
    setError(null);
    const email = String(formData.get("email")).trim().toLowerCase();
    let { error } = await authClient.signIn.email({ email, password: DEV_PASSWORD });
    if (error) {
      ({ error } = await authClient.signUp.email({
        email,
        password: DEV_PASSWORD,
        name: email.split("@")[0],
      }));
    }
    if (error) {
      setError(error.message ?? "Sign-in failed.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {google ? (
        <Button size="lg" className="w-full" onClick={signInWithGoogle} disabled={busy}>
          <GoogleIcon /> Sign in with Google
        </Button>
      ) : (
        <Card className="text-sm text-muted">
          Google sign-in isn&apos;t configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
        </Card>
      )}

      {devLogin ? (
        <Card className="border-dashed">
          <p className="mb-3 text-sm font-semibold text-muted">Developer sign-in (local only)</p>
          <form action={devSignIn} className="space-y-3">
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                defaultValue="dev-parent@example.com"
                className={inputClass}
              />
            </Field>
            <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
              Sign in as developer
            </Button>
          </form>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#fff"
        d="M21.35 11.1h-9.17v2.98h5.25c-.23 1.4-1.64 4.1-5.25 4.1-3.16 0-5.74-2.62-5.74-5.84s2.58-5.84 5.74-5.84c1.8 0 3 .77 3.69 1.43l2.51-2.42C16.8 3.97 14.72 3 12.18 3 7.12 3 3 7.12 3 12.18s4.12 9.18 9.18 9.18c5.3 0 8.81-3.72 8.81-8.97 0-.6-.07-1.06-.14-1.29z"
      />
    </svg>
  );
}
