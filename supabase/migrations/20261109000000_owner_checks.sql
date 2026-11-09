-- Owners get the same rules as categories: a 1–40 character name and a #RRGGBB colour.
-- The app already keeps to these; this makes the database enforce them too.
-- Safe to run more than once.
alter table public.owners drop constraint if exists owners_name_check;
alter table public.owners add constraint owners_name_check check (char_length(name) between 1 and 40);
alter table public.owners drop constraint if exists owners_color_check;
alter table public.owners add constraint owners_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');
