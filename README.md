# Spendit

A personal, month-by-month money tracker (₹, `en-IN`). Plan expected budgets, log the actual spends under them, and always see what's **available to spend**.

Stack: Next.js 15 (App Router, TypeScript) · Supabase (Postgres, RLS, Google OAuth) · Netlify · installable PWA.
The original single-file prototype is in [`reference/prototype.html`](reference/prototype.html); [`SPEC.md`](SPEC.md) is the source of truth.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm test` | Vitest unit tests (`lib/calc.ts` worked example, formatting, backup import/export) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run icons` | Regenerates the PWA icons from `assets/icon-source.webp` (needs Python + Pillow) |
| `npm run gen:types` | Regenerates `lib/database.types.ts` from the linked Supabase project |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Database:** run both files in `supabase/migrations/` in order (`…000000_init.sql`, then `…010000_sync_conflicts.sql`), either in the SQL editor or with the CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   This creates the tables, Row Level Security policies, the trigger that seeds default categories for new users, and the `replace_all_data` function used by backup import.
3. **Google OAuth:**
   - In Google Cloud Console → APIs & Services → Credentials, create an *OAuth client ID* (Web application). Set the **Authorised redirect URI** to `https://<project-ref>.supabase.co/auth/v1/callback`.
   - In Supabase → Authentication → Providers → **Google**: enable it and paste the client ID and secret.
   - In Supabase → Authentication → URL Configuration:
     - **Site URL:** your Netlify URL, e.g. `https://<site>.netlify.app`
     - **Redirect URLs:** add `http://localhost:3000/auth/callback`, `https://<site>.netlify.app/auth/callback`, and, for preview deploys, `https://*--<site>.netlify.app/auth/callback`.
4. Copy the project URL and **anon** key (Settings → API) into `.env.local`. Never put the service-role key in the app.

## Deploy to Netlify

1. Push this repo to GitHub and import it in Netlify. The Next.js runtime is detected automatically, and `netlify.toml` sets the build command.
2. Under Site settings → Environment variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`: the production URL (e.g. `https://<site>.netlify.app`). Leave it unset for deploy previews and the browser's origin is used instead.
3. Deploy from `main`. Pull requests get deploy previews.

## How it's built

```
app/                    layout (font, manifest, SW), page (auth gate → AppShell), login, auth/callback, manifest
components/             AppShell, Hero, Chrome (controls, compact bar, dock), ExpenseList/Card, Gauge,
                        BigNumber, Collapse, DateField, Sheet (stacked bottom sheets + confirm), Toast,
                        ExpenseSheet, IncomeSheet, EntrySheet, MonthPicker, SettingsSheet, Insights
hooks/useMonthData.ts   per-month view of the data + totals
lib/calc.ts             the business rules from SPEC §5 (pure, unit-tested)
lib/format.ts           ₹ en-IN formatting, "03 Nov 2026" dates, month helpers
lib/categories.ts       defaults, palette, keyword auto-pick
lib/backup.ts           zod schema + import/export in the prototype's JSON shape
lib/store.ts            local-first store: optimistic updates, persisted write queue, retry, offline cache
lib/actions.ts          high-level mutations (each delete returns an undo)
supabase/migrations/    schema, RLS, triggers, RPC
public/sw.js            service worker (network-first pages, cache-first static assets)
```

**Sync model.** Every change is applied to local state at once and added to a write queue, which is persisted to `localStorage` along with a cache of the data. The queue flushes to Supabase in order (full-row upserts and deletes by id). Network and server errors retry with backoff, and also when the device comes back online, when the tab becomes visible, and every 60s. A write the database permanently rejects is dropped, and the app reloads from the server. A banner and a toast tell the user when changes are only being saved on the device. Backup import goes through one transactional RPC, so they need a connection.

**Conflicts** (migration `20261103010000_sync_conflicts.sql`):
- Every row carries the `updated_at` of the change that produced it. A database trigger skips any update older than the stored row (last write wins, per row).
- Deleting a row records a tombstone, so a stale offline device can't bring it back. Undo therefore re-creates the row under a new id.
- After pushing its queue, the app always re-fetches, so every device ends up showing the server's copy.

**Device-only mode.** The app runs without an account when:
- the Supabase env vars aren't set, or
- Supabase is unreachable and nobody has signed in on this device yet.

Data is kept under its own local key. At the next sign-in it's added to the account: categories are matched by name so they aren't duplicated, and rows keep their UUIDs so replaying is safe. If Supabase is unreachable but a session cookie exists, the app keeps that account and queues the writes.

**Numbers.** See *Settings → How the numbers work*, or `lib/calc.ts`. One note on SPEC §5 step 6: the spec gives ABB as ₹18,050, but its own formula (`funds − totalSpent` = 20,000 − 2,300 − 650) gives **₹17,050**. The tests assert the formula's value.

## Acceptance checks still to do by hand

- RLS: sign in with two Google accounts and confirm neither can see the other's rows.
- Lighthouse PWA audit, plus install on Android Chrome and iOS Safari.
- 60fps expand/collapse on a mid-range Android phone.
- OAuth on production and on a deploy preview.
