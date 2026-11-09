-- Expected expenses may have no fixed budget (amount = 0): spends are logged under them
-- as they come, and only what's actually spent is subtracted from the balance.
-- One-off "spent" expenses still need an amount above zero.
alter table public.expenses drop constraint if exists expenses_amount_check;
alter table public.expenses add constraint expenses_amount_check
  check (amount > 0 or (kind = 'expected' and amount = 0));
