import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isEmailAllowed } from "@/lib/allowlist";

/**
 * Email + password sign-in exists only for local development and tests,
 * where there are no Google credentials. It must never reach production.
 */
export const devLoginEnabled = process.env.DEV_LOGIN === "true";
if (devLoginEnabled && process.env.VERCEL_ENV === "production") {
  throw new Error("DEV_LOGIN must not be enabled in production");
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const notInvited = () =>
  new APIError("FORBIDDEN", {
    message: "This kitchen is invite-only. Ask a parent to add your email.",
  });

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: devLoginEnabled },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : undefined,
  session: {
    // A family device stays signed in; kids never see a login screen.
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          if (!(await isEmailAllowed(newUser.email))) throw notInvited();
          return { data: { ...newUser, email: newUser.email.toLowerCase() } };
        },
      },
    },
    session: {
      create: {
        before: async (newSession) => {
          // Re-check on every sign-in so removing a parent locks them out.
          const [owner] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, newSession.userId))
            .limit(1);
          if (!owner || !(await isEmailAllowed(owner.email))) throw notInvited();
          return { data: newSession };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export const authProviders = { google: googleConfigured, devLogin: devLoginEnabled };
