-- Owners: who a spend was for (e.g. "Akshay", "Home"). Managed like categories.
--  * expenses.owner_id — owner of a one-off "spent" card; the default for new logs on an "expected" card.
--  * spend_entries.owner_id — owner of each logged spend.
-- Both are optional and existing rows stay empty (assigned by hand later). Income has no owner.
-- Additive only: no existing column, row or policy behaviour is removed.

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owners_user_order on public.owners (user_id, sort_order);

alter table public.owners enable row level security;
drop policy if exists "own rows" on public.owners;
create policy "own rows" on public.owners
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Same offline-sync rules as the other tables (last write wins + tombstones).
drop trigger if exists owners_lww on public.owners;
create trigger owners_lww before insert or update on public.owners
  for each row execute function public.skip_stale_write();
drop trigger if exists owners_tombstone on public.owners;
create trigger owners_tombstone after delete on public.owners
  for each row execute function public.record_delete();

alter table public.expenses add column if not exists owner_id uuid references public.owners on delete set null;
alter table public.spend_entries add column if not exists owner_id uuid references public.owners on delete set null;
create index if not exists expenses_owner on public.expenses (owner_id);
create index if not exists spend_entries_owner on public.spend_entries (owner_id);

-- A row may only point at the caller's own owner.
drop policy if exists "own rows" on public.expenses;
create policy "own rows" on public.expenses
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()))
    and (owner_id is null or exists (
      select 1 from public.owners o where o.id = owner_id and o.user_id = auth.uid()))
  );
drop policy if exists "own rows" on public.spend_entries;
create policy "own rows" on public.spend_entries
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
    and (owner_id is null or exists (
      select 1 from public.owners o where o.id = owner_id and o.user_id = auth.uid()))
  );

-- Starting owners for existing accounts that have none yet.
insert into public.owners (user_id, name, color, sort_order)
select u.id, d.name, d.color, d.ord
from auth.users u
cross join (values ('Akshay', '#8DB8F2', 0), ('Home', '#8FD9A8', 1)) as d(name, color, ord)
where not exists (select 1 from public.owners o where o.user_id = u.id);

-- Backup import now carries owners. p_owners = null (an older app version) leaves owners alone.
drop function if exists public.replace_all_data(jsonb, jsonb, jsonb, jsonb);
create or replace function public.replace_all_data(
  p_categories jsonb,
  p_incomes jsonb,
  p_expenses jsonb,
  p_entries jsonb,
  p_owners jsonb default null
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
  if p_owners is not null then
    delete from public.owners where user_id = uid;
    insert into public.owners (id, user_id, name, color, sort_order, created_at)
    select r.id, uid, r.name, r.color, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
    from jsonb_to_recordset(p_owners) as r(
      id uuid, name text, color text, sort_order int, created_at timestamptz);
  end if;

  insert into public.categories (id, user_id, name, color, sort_order, created_at)
  select r.id, uid, r.name, r.color, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_categories, '[]')) as r(
    id uuid, name text, color text, sort_order int, created_at timestamptz);

  insert into public.incomes (id, user_id, month_key, name, amount, date, created_at)
  select r.id, uid, r.month_key, r.name, r.amount, r.date, coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_incomes, '[]')) as r(
    id uuid, month_key text, name text, amount numeric, date date, created_at timestamptz);

  -- Owner ids that don't belong to the caller are dropped rather than failing the import.
  insert into public.expenses (id, user_id, month_key, name, category_id, owner_id, kind, amount, date, note, created_at)
  select r.id, uid, r.month_key, r.name, r.category_id,
    (select o.id from public.owners o where o.id = r.owner_id and o.user_id = uid),
    r.kind, r.amount, r.date, coalesce(r.note, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_expenses, '[]')) as r(
    id uuid, month_key text, name text, category_id uuid, owner_id uuid, kind text, amount numeric, date date, note text, created_at timestamptz);

  insert into public.spend_entries (id, user_id, expense_id, owner_id, amount, date, note, created_at)
  select r.id, uid, r.expense_id,
    (select o.id from public.owners o where o.id = r.owner_id and o.user_id = uid),
    r.amount, r.date, coalesce(r.note, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(coalesce(p_entries, '[]')) as r(
    id uuid, expense_id uuid, owner_id uuid, amount numeric, date date, note text, created_at timestamptz);
end $$;

grant execute on function public.replace_all_data(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
