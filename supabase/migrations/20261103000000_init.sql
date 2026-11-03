-- Expense tracker schema (spec §4)

create extension if not exists pgcrypto;

-- Categories (user-configurable "types of expense")
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Income sources per month (the opening bank balance is just one source)
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date,
  created_at timestamptz not null default now()
);

-- Expenses per month: kind = 'expected' (a budget) or 'spent' (a one-off payment)
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  category_id uuid references public.categories on delete set null,
  kind text not null check (kind in ('expected','spent')),
  amount numeric(12,2) not null check (amount > 0),
  date date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actual spends logged under an expected expense
create table public.spend_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  expense_id uuid not null references public.expenses on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index on public.categories (user_id, sort_order);
create index on public.incomes (user_id, month_key);
create index on public.expenses (user_id, month_key);
create index on public.expenses (category_id);
create index on public.spend_entries (expense_id);
create index on public.spend_entries (user_id);

-- updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

-- Row Level Security
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.spend_entries enable row level security;

create policy "own rows" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.incomes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.expenses
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()))
  );
create policy "own rows" on public.spend_entries
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  );

-- Default categories for every new user
create or replace function public.seed_default_categories(uid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.categories (user_id, name, color, sort_order)
  select uid, d.name, d.color, d.ord
  from (values
    ('Fuel', '#F8C78A', 0),
    ('Groceries', '#8FD9A8', 1),
    ('Rent & Housing', '#A3A8F0', 2),
    ('Bills & Utilities', '#7FD1D9', 3),
    ('Food & Dining', '#F7A68C', 4),
    ('Transport', '#8DB8F2', 5),
    ('Shopping', '#F2A7C9', 6),
    ('Health', '#EE9A9A', 7),
    ('Entertainment', '#C3A6EE', 8),
    ('EMI & Loans', '#A8B4C4', 9),
    ('Subscriptions', '#D6B4E8', 10),
    ('Other', '#D9C2A3', 11)
  ) as d(name, color, ord);
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Replace all of the caller's data in one transaction (backup import).
-- Runs as the caller, so RLS still applies; every row is forced to auth.uid().
create or replace function public.replace_all_data(
  p_categories jsonb,
  p_incomes jsonb,
  p_expenses jsonb,
  p_entries jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from public.spend_entries where user_id = uid;
  delete from public.expenses where user_id = uid;
  delete from public.incomes where user_id = uid;
  delete from public.categories where user_id = uid;

  insert into public.categories (id, user_id, name, color, sort_order, created_at)
  select r.id, uid, r.name, r.color, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_categories, '[]')) as r(
    id uuid, name text, color text, sort_order int, created_at timestamptz);

  insert into public.incomes (id, user_id, month_key, name, amount, date, created_at)
  select r.id, uid, r.month_key, r.name, r.amount, r.date, coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_incomes, '[]')) as r(
    id uuid, month_key text, name text, amount numeric, date date, created_at timestamptz);

  insert into public.expenses (id, user_id, month_key, name, category_id, kind, amount, date, note, created_at)
  select r.id, uid, r.month_key, r.name, r.category_id, r.kind, r.amount, r.date, coalesce(r.note, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_expenses, '[]')) as r(
    id uuid, month_key text, name text, category_id uuid, kind text, amount numeric, date date, note text, created_at timestamptz);

  insert into public.spend_entries (id, user_id, expense_id, amount, date, note, created_at)
  select r.id, uid, r.expense_id, r.amount, r.date, coalesce(r.note, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_entries, '[]')) as r(
    id uuid, expense_id uuid, amount numeric, date date, note text, created_at timestamptz);
end $$;

grant execute on function public.replace_all_data(jsonb, jsonb, jsonb, jsonb) to authenticated;
