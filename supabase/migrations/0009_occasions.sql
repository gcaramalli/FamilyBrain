-- Dates worth celebrating: weddings, birthdays of people outside the calendar.
-- Kept apart from `events` so friends' anniversaries never clutter the family
-- calendar; only `ours` (our own wedding, etc.) is shown there. Reminders go
-- out the evening before (see /api/cron/reminders).
create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  kind text not null default 'wedding' check (kind in ('wedding', 'birthday', 'other')),
  title text not null check (char_length(title) <= 200),
  -- The original day (wedding day, date of birth); celebrated every year.
  date date not null,
  -- About our own family: shown in the calendar.
  ours boolean not null default false,
  -- Who was there / who it matters to; reminders go to these members (everyone when empty).
  member_ids uuid[] not null default '{}',
  -- No longer celebrated (e.g. divorced): kept as memory, never reminded.
  ended boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index occasions_family on public.occasions (family_id);

alter table public.occasions enable row level security;
create policy "family all" on public.occasions for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));
