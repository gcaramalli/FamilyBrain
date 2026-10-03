-- Uneven splits. The family's usual split ("Guillaume 60 / Jenny 40") lives in
-- expense_settings, editable by both parents (families is admin-only). Each
-- expense keeps its own copy in `shares` when it is not an equal split, so
-- changing the usual split later never rewrites past expenses.

create table public.expense_settings (
  family_id uuid primary key default private.my_family_id() references public.families(id) on delete cascade,
  -- {member_id: weight}, e.g. {"<guillaume>": 60, "<jenny>": 40}; empty = equal
  shares jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.expense_settings enable row level security;

create policy "family all" on public.expense_settings for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));

-- {member_id: weight}: a percentage (60/40) or the amounts typed by hand; only
-- the ratio counts. null = equal shares between split_among. split_among stays
-- the people with a weight above zero.
alter table public.expenses add column shares jsonb;
