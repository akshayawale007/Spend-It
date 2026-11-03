# Expense Tracker — Product & Build Spec

> Hand-off document for rebuilding the expense tracker as a production web app.
> Stack: **Next.js (App Router, TypeScript)** · **Supabase** (Postgres + Auth with Google) · hosted on **Netlify** · installable **PWA**.
> A working single-file prototype exists (`expense-tracker.html`). Put it in the repo at `/reference/prototype.html` and treat it as the visual and behavioural reference. Where this spec and the prototype disagree, **this spec wins**.

---

## 1. What the app is

A personal, month-by-month money tracker for one person (an Indian user, so ₹ and the `en-IN` number format).

The core idea:

- You tell the app how much money you have this month (**income sources**, including your opening bank balance).
- You plan **expected** expenses (budgets such as Petrol ₹2,000 or Rent ₹8,000). Each one is subtracted from the available amount straight away.
- As the month goes on, you **log the actual spends** under each expected expense (₹500 petrol on the 5th, ₹500 on the 12th…). A small gauge on that expense fills up.
- One-off payments can be added directly as **spent** expenses, with no budget and no gauge.
- A big number at the top always shows what's **available to spend**.

Everything is calculated **strictly per month**. Nothing carries over from one month to the next.

---

## 2. Tech stack & project setup

| Concern | Choice |
|---|---|
| Framework | Next.js 15+ (App Router), TypeScript, React Server Components where useful, but the main app screen is a client component |
| Styling | Plain CSS with CSS variables (CSS Modules or one global stylesheet). Tailwind is allowed, but the glass look and tokens in §8 must be reproduced exactly |
| Font | Plus Jakarta Sans via `next/font/google` (weights 400–800) |
| Database & Auth | Supabase. Use `@supabase/supabase-js` plus `@supabase/ssr` for cookie-based auth in Next.js |
| Login | Google OAuth through Supabase Auth (the only login method) |
| Data fetching | Client-side Supabase queries with a small cache layer (TanStack Query recommended) and optimistic updates |
| Hosting | Netlify with the Next.js runtime (auto-detected; `@netlify/plugin-nextjs`) |
| PWA | Web app manifest, icons and a service worker (e.g. `@serwist/next`), so it can be installed on the phone home screen |
| Validation | `zod` for form and import validation |

**Environment variables** (Netlify site settings plus a local `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=          # e.g. https://<site>.netlify.app (used for OAuth redirect)
```

Never ship the service-role key to the client.

---

## 3. Authentication

- The landing page `/login` is a centred glass card with the app name, a one-line tagline ("Plan your month. Track every rupee.") and a **Continue with Google** button.
- Use `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${SITE_URL}/auth/callback` } })`.
- `/auth/callback` exchanges the code for a session (`exchangeCodeForSession`), then redirects to `/`.
- Middleware (`middleware.ts`) refreshes the session cookie and redirects unauthenticated users to `/login`.
- The Settings sheet has a **Sign out** button and shows the signed-in email and avatar.
- **Supabase dashboard setup** (document this in the README): enable the Google provider, add the Google OAuth client ID and secret, and add the `/auth/callback` URLs for localhost and Netlify to the redirect allow-list. In Google Cloud, set the authorised redirect URI to `https://<project>.supabase.co/auth/v1/callback`.

---

## 4. Data model (Supabase / Postgres)

All money is `numeric(12,2)`. A month is identified by `month_key text` in the form `YYYY-MM`. Every table has `user_id uuid not null default auth.uid() references auth.users on delete cascade`.

```sql
-- Categories (user-configurable "types of expense")
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Income sources per month (the opening bank balance is just one source)
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date,                       -- optional
  created_at timestamptz not null default now()
);

-- Expenses per month: kind = 'expected' (a budget) or 'spent' (a one-off payment)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  category_id uuid references categories on delete set null,
  kind text not null check (kind in ('expected','spent')),
  amount numeric(12,2) not null check (amount > 0),  -- budget if expected, amount paid if spent
  date date,                                          -- used when kind = 'spent'
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actual spends logged under an expected expense
create table spend_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  expense_id uuid not null references expenses on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index on incomes (user_id, month_key);
create index on expenses (user_id, month_key);
create index on spend_entries (expense_id);
```

**Row Level Security (mandatory, on every table):**

```sql
alter table categories enable row level security;
alter table incomes enable row level security;
alter table expenses enable row level security;
alter table spend_entries enable row level security;

-- repeat for each table
create policy "own rows" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`spend_entries` must also check that the parent expense belongs to the same user. Do this with a `with check (exists (select 1 from expenses e where e.id = expense_id and e.user_id = auth.uid()))`, or with a trigger.

**Default categories:** create them for each new user, either with a `security definer` trigger on `auth.users` insert or client-side on first load when the user has zero categories. The defaults, in order:

| Name | Colour |
|---|---|
| Fuel | `#F8C78A` |
| Groceries | `#8FD9A8` |
| Rent & Housing | `#A3A8F0` |
| Bills & Utilities | `#7FD1D9` |
| Food & Dining | `#F7A68C` |
| Transport | `#8DB8F2` |
| Shopping | `#F2A7C9` |
| Health | `#EE9A9A` |
| Entertainment | `#C3A6EE` |
| EMI & Loans | `#A8B4C4` |
| Subscriptions | `#D6B4E8` |
| Other | `#D9C2A3` |

**Kind changes:** an expense keeps its `spend_entries` when it is switched from expected to spent. They are hidden while the kind is `spent` and come back if it is switched back to `expected`.

Put all SQL in `supabase/migrations/` and generate TypeScript types with `supabase gen types`.

---

## 5. Business rules & calculations (exact)

For the selected month `M`:

```
funds        = Σ incomes.amount                                  (month M)
spentOf(e)   = e.kind == 'spent' ? e.amount : Σ entries(e).amount
totalSpent   = Σ spentOf(e) over all expenses in M
monthClosed  = M < current month (by the user's local date)

deduction(e) =
  if e.kind == 'spent'            → e.amount
  else if monthClosed             → spentOf(e)                    -- unused budget released after month end
  else                            → max(e.amount, spentOf(e))     -- budget reserved; overspend counts in full

AVAILABLE    = funds − Σ deduction(e)            -- the big number
ABB          = funds − totalSpent                 -- "Actual Bank Balance": money really left right now
gauge %      = spentOf(e) / e.amount × 100        -- expected only; display can exceed 100
isFull(e)    = e.kind == 'expected' && spentOf(e) >= e.amount
isDone(e)    = e.kind == 'spent' || isFull(e)     -- shows the green tick
```

Worked example (must pass as a test):

1. Income ₹20,000 gives Available ₹20,000 and ABB ₹20,000.
2. Add expected Petrol ₹2,000. Available is ₹18,000 and ABB is still ₹20,000.
3. Log ₹500 under Petrol. Gauge 25%, Available ₹18,000, ABB ₹19,500, Spent ₹500.
4. Log another ₹500. Gauge 50%, Available ₹18,000, ABB ₹19,000.
5. Petrol spends reach ₹2,300. Gauge 115% in red, Available ₹17,700, card shows the overspend in red.
6. Add a spent Zomato ₹650. Available ₹17,050, ABB ₹18,050.
7. Once the month has ended, if Petrol only used ₹1,500, the remaining ₹500 is released: that month's Available goes up by ₹500.

Other rules:

- **No carry-forward** of money between months. Every month starts from zero income.
- **Copy budgets:** when the current month has no expected expenses and the previous month does, offer "Copy N budgets from <Month>". It copies name, category, amount and note of expected items only, with no entries and no money.
- There is **no "mark as done" button**. The tick is automatic: spent items always have it, and expected items get it at 100%.
- Amounts must be > 0. Up to 2 decimals are allowed. Display with `en-IN` grouping (₹1,00,000).
- **Date display format everywhere: `03 Nov 2026`** (`DD Mon YYYY`, built manually, not via locale, to avoid "Sept"). Stored as ISO `date`.
- The default date for a new spend is today if the selected month is the current month, otherwise the 1st of the selected month.
- **Deleting a category:** if it's in use, ask for confirmation ("N expenses use Fuel. They'll move to Other."), then reassign them to the category named "Other" (or the first remaining category). The last category can't be deleted.

---

## 6. Screens & UX

The layout is mobile-first, centred, with `max-width: 540px`. On desktop, sheets become centred modals.

### 6.1 Persistent chrome

- **Top-right controls (fixed, always visible, small):**
  - a month pill, e.g. `Nov 2026 ⌄` (34px tall, glass), which opens the month picker;
  - a settings icon button (34px circle, glass), which opens Settings.
- **Bottom dock (fixed, glass pill, centred):** `[≡ Expenses]  [ + ]  [◔ Insights]`.
  - The centre `+` is a 52px dark circle that opens the "New expense" sheet.
  - The active tab has a white pill background. Tapping the active tab scrolls to the top.
- **Compact sticky balance bar:** when the hero card scrolls out of view (its bottom is above about 76px from the top), a slim glass bar (54px) fades and slides in at the top-left. It shows `AVAILABLE ₹X | ABB ₹Y` and leaves room on the right for the fixed controls. A soft background fade sits behind it. Tapping it scrolls to the top. Expenses tab only.

### 6.2 Expenses tab

**Hero / balance card (glass, 28px radius):**

- **Collapsed (default):**
  - Label: "Available to spend" ("Left at month end" for past months).
  - The big number: 46–66px, weight 760, tight letter-spacing, a smaller grey ₹. It animates with a count-up (650ms, ease-out-cubic) when the value changes, and turns red if negative, with a note "₹X more planned than you have".
  - A foot row with two small stats, **SPENT ₹X** and **ABB ₹Y** (ABB in red if negative), and on the right a small pill "Income ⌄" ("Add balance ⌄" when there's no income).
- **Tapping anywhere on the card** expands or collapses it with a smooth height animation:
  - "INCOME SOURCES · ₹total" header;
  - one row per income (green up-arrow icon, name, optional date, amount; tap to edit);
  - if there's no income, a dashed "＋ Add your account balance" button (pre-fills the name "Opening balance");
  - a "＋ Add income source" button.
- Income buttons are **only visible when the card is expanded**.

**Expense list:**

- Header: "EXPENSES" with "N items · M open".
- A single unified list, with no separate sections or filter tabs. Sort order: open expected items first (oldest created first), then done items (spent and fully-used budgets), newest date first.
- **Expense card:** 22px radius, a light gradient tinted by the category colour from the left, a translucent white surface and a hairline white border. Do **not** use `backdrop-filter` on list cards (it causes scroll and animation jank); keep blur for the hero, bars, dock and sheets.
  - Top line: **name** (bold, truncates) + ✓ green tick if done + **category tag** pill (category colour at 30% on white, dark tinted text, small dot).
  - Values row with small uppercase labels:
    - expected: `EXPECTED ₹2,000` and `SPENT ₹500` (red if over);
    - spent: `SPENT ₹650` and `DATE 03 Nov 2026`.
  - Right side:
    - expected: a **semicircle gauge** (50×30 SVG arc, track plus fill in a darker tint of the category colour, red when over 100%) with `25%` under it. The fill animates (1s ease) from its previous value whenever it changes.
    - spent: a 40px rounded square tinted with the category colour, with a ✓.
  - A chevron, rotated when open. Tapping the card expands or collapses it with a smooth JS-measured height animation (≈340ms).
- **Expanded expected card:**
  - The note, if any.
  - The list of logged spends (no header line), each row `03 Nov 2026 · note · ₹500`. Tap a row to edit or delete it.
  - The quick-log form:
    - row 1: `₹ Amount` | `date field`;
    - row 2: `Note (optional)` at full width;
    - row 3: `[＋ Log spend]` (dark) | `[✎ Edit]` (ghost).
  - After logging, the gauge animates up. A toast says "Logged ₹500 under Petrol". On reaching 100%, the card does a gentle pop and the toast says "Petrol budget fully used" (or "over budget by ₹X").
- **Expanded spent card:** the note, then `[✎ Edit]` and `[↺ Make it expected]`.
- **Empty month:** a glass card with an icon, "Nothing planned for November yet", one line of help, and the buttons "＋ Add expense" and, when available, "Copy N budgets from October".

### 6.3 Add / edit expense sheet (bottom sheet)

- Title "New expense" / "Edit expense", with the month underneath.
- A **colour preview card** whose gradient background transitions to the selected category's colour (animate the colour; registering `--c` with `@property` works). Inside it:
  - a segmented toggle, **Expected | Spent**;
  - the name input (borderless, translucent; placeholder "Expense name, e.g. Petrol");
  - a big amount input (32px, weight 790, ₹ prefix);
  - a footer with "Monthly budget" or "Amount spent", plus the selected category tag.
- A hint line under the card:
  - Expected: "Reserved from your balance now — log each payment under it as the month goes."
  - Spent: "A one-off payment you've already made."
- **Category picker:** a **single-row horizontal scroller** of chips (scroll-snap, faded edges, no scrollbar) with "＋ New" at the end. "＋ New" reveals an inline name field and Add button; the new category gets the next unused palette colour. The selected chip scrolls into view.
- **Auto-pick a category from the name** until the user picks one manually. Keyword map:
  - Fuel: petrol, diesel, fuel, cng
  - Groceries: grocery, vegetables, milk, fruit, kirana, bigbasket, blinkit, zepto, instamart, dmart
  - Rent & Housing: rent, maintenance, society
  - Bills & Utilities: electricity, bill, water, wifi, internet, broadband, recharge, lpg, cylinder, dth
  - Food & Dining: food, zomato, swiggy, restaurant, cafe, coffee, lunch, dinner, breakfast, snack
  - Transport: uber, ola, rapido, metro, bus, auto, cab, taxi, train, toll, parking, flight, travel
  - Shopping: amazon, flipkart, myntra, meesho, shop, clothes, shoes
  - Health: doctor, medicine, pharmacy, hospital, clinic, gym, health, insurance
  - Entertainment: movie, outing, party, game, concert
  - EMI & Loans: emi, loan, credit card
  - Subscriptions: netflix, prime, spotify, hotstar, youtube, subscription, icloud
- A date field (only for Spent) and a Note field, side by side for Spent and full width for Expected.
- **Switching kind while editing:**
  - Expected → Spent with entries: prefill the amount with the entries' total. Hint: "Amount set to ₹X, the total of N logged spends. They come back if you switch to expected."
  - Spent → Expected with no entries: show a checkbox, checked by default, "Log the ₹X already spent on 03 Nov 2026 as the first spend".
- Validation: name and amount (> 0) are required. An invalid field shakes and gets a red ring.
- Buttons: a full-width dark **Add expense / Save changes** button; in edit mode, a red text **Delete expense** button (with an undo toast).

### 6.4 Other sheets

- **Income sheet:** amount (big), source name with suggestion chips (Opening balance, Salary, Freelance, Interest, Refund, Gift), optional date, save, and delete with undo.
- **Edit spend sheet:** amount, date, note, save, and delete with undo.
- **Month picker:** year with ‹ › arrows, a 3×4 month grid (selected month dark, current month outlined, a purple dot under months that have data) and "Jump to this month". Changing month resets the count-up start, scrolls to the top and keeps the open/closed state of cards.
- **Confirm sheet:** the app's own sheet for destructive actions (title, text, red confirm, Cancel). Never use `alert` or `confirm`.
- **Settings sheet (tall):**
  - **Expense categories:** one row per category with a colour swatch, an inline-editable name (saves on a 400ms pause after typing), a usage count ("3 used") and a delete icon. Tapping the swatch reveals a palette of 14 pastels (`#F7A68C #F8C78A #EED97A #8FD9A8 #A9C9A4 #7FD1D9 #8DB8F2 #A3A8F0 #C3A6EE #F2A7C9 #EE9A9A #D9C2A3 #A8B4C4 #D6B4E8`) plus a custom colour input. An "Add category" field sits at the bottom. Drag-to-reorder is a nice extra (it uses `sort_order`).
  - **How the numbers work:** a short plain-language explanation of Available, ABB, overspend, month-end release, auto-tick, no carry-over and Copy budgets.
  - **Your data:**
    - Export backup (JSON download);
    - Import backup (file picker; validate, show "It has N months and M expenses. It replaces everything…", confirm, then replace the user's rows);
    - Erase everything (confirm).
  - **Account:** email, avatar, Sign out.
- **Bottom sheet behaviour:** slides up (380ms), blurred glass, drag handle (dragging it down more than 90px closes the sheet), Escape and a tap on the backdrop close it, body scroll locks while it's open, and sheets can stack.

### 6.5 Insights tab

- A page title "Insights" at the top left (the fixed controls stay top right).
- A summary card with three tiles: **Income**, **Spent**, **Available** (or "Left" for past months).
- A "SPENT BY CATEGORY" card:
  - a 200px donut chart (small gaps between segments, animated draw) with "<Mon> SPENT ₹X" in the centre;
  - then one row per category, sorted by spend: colour dot, name, amount, % of total, a thin animated bar, and, if the category has budgets, "₹500 of ₹2,000 expected" (plus "· ₹X over" in red).
- Empty state when there's no spending yet.

### 6.6 Feedback & polish

- **Toasts:** a dark pill above the dock that auto-hides after 2.6s, or 5s with an **Undo** button for every delete (income, expense, spend).
- **Optimistic UI:** every change shows instantly and syncs in the background. Show a small "Saving… / Saved / Offline" state in Settings, and retry failed writes.
- **Accessibility:** real `<button>`s, `aria-expanded` on collapsibles, `aria-pressed` on toggles and chips, collapsed content `visibility:hidden` (so it can't be reached by keyboard), visible focus rings, respect for `prefers-reduced-motion`, and inputs at 16px or larger (avoids iOS zoom). Amount inputs use `inputmode="decimal"`.
- **Date fields:** show the formatted `03 Nov 2026` text with a calendar icon, with a transparent native `<input type="date">` laid over it. Call `showPicker()` on click where supported.

---

## 7. Data import from the prototype

The prototype's backup file (Settings → Export backup file) has this shape. The app must import it:

```json
{
  "v": 1,
  "categories": [{ "id": "fuel", "name": "Fuel", "color": "#F8C78A" }],
  "months": {
    "2026-11": {
      "incomes":  [{ "id": "…", "name": "Opening balance", "amount": 20000, "date": "", "carry": "" }],
      "expenses": [{
        "id": "…", "name": "Petrol", "categoryId": "fuel", "kind": "expected",
        "amount": 2000, "date": "", "note": "", "done": false, "createdAt": 1793679275000,
        "entries": [{ "id": "…", "amount": 500, "date": "2026-11-03", "note": "" }]
      }]
    }
  }
}
```

The importer:

- maps old category ids to new UUIDs;
- turns empty `""` dates into `null`;
- ignores `done` and `carry`;
- converts `createdAt` (ms) into `created_at`;
- does everything in a single Postgres function (RPC) or a batched transaction, so a failed import leaves no half-written data.

The export uses the same shape, so files can move both ways between the prototype and the app.

---

## 8. Visual design tokens (light glass, minimalist)

```css
--ink:#1c1f2a; --ink-2:#575d6e; --ink-3:#8a8f9e;
--glass:rgba(255,255,255,.58);   /* hero, bars, dock: + backdrop-filter: blur(22px) saturate(170%) */
--card:rgba(255,255,255,.66);    /* list cards: NO backdrop-filter */
--edge:rgba(255,255,255,.88);    /* 1px borders */
--hair:rgba(28,31,42,.07);       /* dividers */
--shadow:0 1px 1px rgba(30,35,60,.03),0 10px 28px -14px rgba(30,35,60,.18);
--ok:#2f9e6e; --over:#df5a5e; --focus:rgba(124,112,255,.18);
--ease:cubic-bezier(.22,.8,.24,1);
```

- **Page background:** a fixed layer of soft radial gradients (peach `#ffe0d1` top-left, lavender `#e2dbff` top-right, mint `#d2f2e5` bottom-right, butter `#fff0c8` bottom-left) over `#f6f4f9`.
- **Radii:** hero 28px · cards 22px · sheets 30px (top corners) · inputs 12–14px · pills 999px.
- **Type:** Plus Jakarta Sans. Small uppercase labels are 10.5–12px, weight 700–750, letter-spacing .06–.08em. Numbers use `font-variant-numeric: tabular-nums`.
- **Category tint helpers:** `color-mix(in srgb, var(--c) 30%, white)` for tag backgrounds and `color-mix(in srgb, var(--c) 30%, #1c1f2a)` for tag text.
- **Theme colour** in the manifest: `#f6f4f9`.

---

## 9. Suggested project structure

```
app/
  layout.tsx            # font, metadata, manifest link, providers
  page.tsx              # main app (client): tabs, hero, list, insights
  login/page.tsx
  auth/callback/route.ts
components/             # Hero, CompactBar, ExpenseCard, Gauge, Donut, Sheet, ExpenseSheet,
                        # IncomeSheet, EntrySheet, MonthPicker, SettingsSheet, DateField, Toast, Dock
lib/
  supabase/{client,server,middleware}.ts
  calc.ts               # pure functions from §5 (unit-tested)
  format.ts             # fmt(₹, en-IN), fullDate('03 Nov 2026'), month helpers
  categories.ts         # defaults, palette, keyword auto-pick
  backup.ts             # import/export (zod schema for §7)
hooks/                  # useMonthData(monthKey), mutations with optimistic updates
supabase/migrations/    # §4 SQL
public/                 # icons (192, 512, maskable), manifest
reference/prototype.html
middleware.ts
```

---

## 10. Testing & acceptance checklist

- [ ] Unit tests (Vitest) for `calc.ts` covering the full worked example in §5, overspend, a closed month and an empty month.
- [ ] Unit tests for `fullDate` (`2026-09-03` → `03 Sep 2026`) and `en-IN` money formatting.
- [ ] Two different Google accounts never see each other's data (verify RLS by querying with user B's session).
- [ ] Every change works optimistically and survives a reload; going offline then back online syncs.
- [ ] Importing the prototype's backup reproduces the same Available, ABB and gauge values.
- [ ] Lighthouse PWA: installable on Android Chrome and iOS Safari (Add to Home Screen) and opens full-screen.
- [ ] Smooth 60fps expand/collapse on a mid-range Android phone; no layout jump when the compact bar appears.
- [ ] Netlify deploy from `main`; preview deploys on PRs; OAuth redirect works on both.

## 11. Nice-to-haves (later)

Recurring monthly budgets (auto-copy on the 1st), search, CSV export, reminders on budgets close to 100%, dark mode, shared household budgets, and a month-over-month trends chart on Insights.
