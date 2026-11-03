-- Conflict-safe offline sync.
--  * Last write wins per row: every row carries the client's updated_at, and an
--    update older than what the server already has is silently skipped.
--  * Deletes leave a tombstone, so a stale offline device can't bring a deleted row back.

alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.incomes add column if not exists updated_at timestamptz not null default now();
alter table public.spend_entries add column if not exists updated_at timestamptz not null default now();

-- The client now sets updated_at itself.
drop trigger if exists expenses_touch on public.expenses;
drop function if exists public.touch_updated_at();

create table if not exists public.deleted_rows (
  id uuid primary key,
  user_id uuid not null,
  table_name text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_rows_user on public.deleted_rows (user_id);
alter table public.deleted_rows enable row level security;
drop policy if exists "own rows" on public.deleted_rows;
create policy "own rows" on public.deleted_rows for select using (user_id = auth.uid());

create or replace function public.skip_stale_write() returns trigger
language plpgsql as $$
begin
  if new.updated_at is null or new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();  -- guard against a device clock far in the future
  end if;
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;  -- older than the server copy: keep the server copy
  end if;
  if tg_op = 'INSERT' and exists (select 1 from public.deleted_rows d where d.id = new.id) then
    return null;  -- already deleted elsewhere: don't resurrect it
  end if;
  return new;
end $$;

create or replace function public.record_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.deleted_rows (id, user_id, table_name)
  values (old.id, old.user_id, tg_table_name)
  on conflict (id) do nothing;
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories', 'incomes', 'expenses', 'spend_entries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_lww', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.skip_stale_write()', t || '_lww', t);
    execute format('drop trigger if exists %I on public.%I', t || '_tombstone', t);
    execute format('create trigger %I after delete on public.%I for each row execute function public.record_delete()', t || '_tombstone', t);
  end loop;
end $$;
