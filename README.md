# 🎡 Cruz Meals

Family dinners, decided. Cruz Meals remembers what everyone likes, knows who's home tonight, plans the week around how much time you actually have, builds the grocery list, and spins a wheel when nobody can agree.

Each family runs its own copy: one deployment, one family, your data in your own database.

## Features

- **Profiles for everyone.** Parents sign in with Google; kids tap their avatar (optional 4-digit PIN). Each person has a spice tolerance, a humor style ("full goofball" or "dry wit"), foods they love, and foods they won't eat.
- **Home and away.** Mark school breaks, trips, and practice nights. A "coming home in 3 days!" banner counts down to a boarding-school kid's return and gives them first pick.
- **Recipe box.** Structured recipes with hands-on vs. total time, servings scaling, healthy swaps, mild versions, protein swaps for picky eaters, and an indoor fallback for grilled dinners.
- **Cook mode.** Check off ingredients and steps, built-in step timers, and a "keep screen on" toggle.
- **Printable recipe cards.**
- **Starter library** of 17 weeknight-friendly family dinners and 6 sides.

Coming next: weekly planning and grocery lists, smart suggestions and ratings, AI recipe generation and import, and the Sunday swipe-and-spin session. See the [roadmap](#roadmap).

## Run it locally

Requirements: Node.js 20.9 or later. Nothing else: `npm run dev` downloads and runs a local Postgres for you.

```bash
npm install
cp .env.example .env.local   # then fill in BETTER_AUTH_SECRET and set DEV_LOGIN=true
npm run dev                  # http://localhost:3100
```

With `DEV_LOGIN=true`, the sign-in page offers a developer sign-in, so you don't need Google credentials locally. Add the email you use to `ALLOWED_EMAILS`.

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts local Postgres (data in `.data/postgres`), migrates, runs Next.js on port 3100 |
| `npm test` | Unit and database tests (in-memory Postgres, no setup needed) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

## Deploy your own

1. **Fork** this repo on GitHub.
2. **Import it into [Vercel](https://vercel.com/new).** In the project's *Storage* tab, add a **Neon** Postgres database; Vercel sets `DATABASE_URL` for you.
3. **Create Google sign-in credentials** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials): an OAuth client ID of type *Web application*, with authorized redirect URI `https://<your-domain>/api/auth/callback/google`.
4. **Set environment variables** in Vercel (Settings → Environment Variables):
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: your site's URL, e.g. `https://dinner.example.com`
   - `ALLOWED_EMAILS`: the parents' Google emails, comma separated
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `ANTHROPIC_API_KEY` (optional, for AI recipe features)
5. **Deploy.** Migrations run automatically during the build (`vercel-build`). Open the site, sign in, and the setup wizard walks you through your family.

To pick up new features later, click **Sync fork** on GitHub; Vercel redeploys and migrates.

## How it's built

- [Next.js 16](https://nextjs.org) App Router, React 19, TypeScript, Tailwind CSS 4
- [Drizzle ORM](https://orm.drizzle.team) on Postgres ([Neon](https://neon.tech) in production)
- [Better Auth](https://www.better-auth.com) with Google sign-in
- [Vitest](https://vitest.dev) with [PGlite](https://pglite.dev) for fast, isolated database tests

Family-specific data lives only in the database. The jokes live in `src/lib/copy.ts`; edit them to add your family's inside jokes.

## Roadmap

1. ✅ **Foundation:** sign-in, profiles, setup wizard, recipe box, starter library, home/away dates
2. **Plan and shop:** weekly plan, merged grocery list (live sync, works offline), print views
3. **Smart suggestions:** scoring, repeat cooldowns, spice handling, seasons, shared ingredients, health mix, ratings
4. **AI recipes:** generate, import from a link or photo, healthy and mild variants, a new meal each week
5. **Sunday session and fun:** swipe round, the wheel, veto cards and power-ups, fair turns, badges
