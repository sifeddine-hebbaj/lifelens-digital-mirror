# LifeLens

LifeLens is a private daily journal and self-tracking app built with Next.js, TypeScript, Tailwind CSS, shadcn/ui conventions, and Supabase. It includes daily check-ins, a timeline, trends, goals, saved AI insights, and AI-assisted reflection.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app shell runs without credentials and the sign-in page explains what to configure. Supabase credentials are required for authentication and database operations.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the app tables, indexes, signup trigger, and row-level security policies.
3. Add the project URL and anon/public key to `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In Supabase Authentication, enable email/password sign-in. For local testing, either disable email confirmation or confirm the signup email before signing in.
5. Restart the dev server after changing environment variables.

The schema never grants client access to another user’s rows. Deleting an auth user cascades to their LifeLens data.

## AI features

Set `GEMINI_API_KEY` in `.env.local` to enable AI Insights, Ask AI, Live voice, and Google Search. The server loads relevant dated metrics, activities, habits, goals/progress, journal reflections, events, saved insights, and detected patterns for the authenticated user. Relevant journal text may be sent to Gemini to answer personal questions; the chat screen discloses this. Written-chat Web Search is permission-based: LifeLens answers directly first and, when current external information would genuinely help, asks once before searching. After the user agrees (e.g. "wakha", "yes", "oui", "نعم"), it searches immediately and does not ask again for follow-up searches in the same task. The search planner sees only the user's own message (never Supabase context), and Google receives only a short generic query with emails, phone numbers, and links stripped. Apply `supabase/migrations/20261003000000_ai_web_search_permission.sql` to store this per-conversation consent; without it, chat works but Web Search stays off. Grounded sources are shown with replies; if Google returns a quota/rate-limit error, LifeLens says that web verification was unavailable rather than inventing citations. Live voice uses a short-lived, single-use token locked to the server-provided system instruction and Supabase context; Web Search is not enabled in Live because the current ephemeral-token endpoint rejects Live tool declarations. Microphone audio is streamed directly from the browser to Gemini over the Live API; transcribed turns are saved to the user's private conversation. Gemini Live does not persist client history in LifeLens beyond those transcript rows. AI insights still require at least 14 daily entries for recurring patterns. Generated speech is streamed for immediate playback and is not saved. Microphone capture requires HTTPS or localhost, so browsers do not expose a microphone over plain HTTP LAN URLs. Free-tier availability, limits, and data handling follow Google's current Gemini API terms. Without the key, tracking, trends, goals, and profile remain available.

## Budget module

LifeLens includes a private budget tracker under `/budget`: monthly spending limit, annual budget, savings balance and goal, expenses, income, recurring payments and printable reports. It follows the same rules as the rest of the app: every row belongs to the signed-in user and is protected by Supabase row-level security, and it uses the language (FR / AR / EN) and the currency chosen in the profile.

The Budget schema is versioned in [`supabase/migrations/20261001000000_budget_module.sql`](supabase/migrations/20261001000000_budget_module.sql). Apply pending migrations locally with the Supabase CLI after linking the project (`supabase link --project-ref <project-ref>`, then `supabase db push`). The GitHub Actions workflow applies pending migrations automatically on pushes to `main` that change a migration. Configure repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD` for it to connect. The base application schema in `supabase/schema.sql` is still required first.

Choose your currency in **Profile** (MAD is available). Amounts are formatted with it.

What it does:

| Page | Purpose |
|---|---|
| `/budget` | Month overview: income, expenses, net, budget left, spending by category, savings balance and goal, monthly settings, upcoming payments |
| `/budget/expenses` | Add, edit, delete and search expenses; add and delete income (income feeds the savings balance) |
| `/budget/recurring` | Subscriptions and bills (monthly or yearly), due-date highlighting, “mark paid” logs the expense and moves the due date forward |
| `/budget/reports` | Month, year or custom period with totals, category and monthly charts, CSV export and print / save as PDF |

Rules worth knowing:

- Each month has its own limit, annual budget and savings goal. A month with nothing saved shows the values of the nearest earlier month; editing one month never rewrites another.
- The savings balance is never stored. It is always income up to the end of the month plus the logged corrections, so it cannot drift out of sync.
- Recurring payments can send one email reminder per due date. Apply `supabase/migrations/20261001020000_budget_email_reminders.sql`, deploy to Vercel (the daily 09:00 UTC cron is in `vercel.json`), and configure `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `BUDGET_REMINDER_FROM` in the deployment environment. `BUDGET_REMINDER_FROM` must be a sender verified with Resend. The reminder is sent to the recurring payment owner's LifeLens account email.

## Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

The project uses shadcn/ui-compatible configuration in `components.json` and a small local button primitive in `components/ui`. Add further shadcn components with `npx shadcn@latest add <component>`.
