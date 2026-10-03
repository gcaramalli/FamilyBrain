-- Shared expenses (a small Tricount): one parent pays for the family, the app
-- keeps the balance between the adults and says who owes whom. A paid-back
-- amount is a row too (settlement = true): the payer gives `amount` to the one
-- person in split_among, which evens the balance out by the same arithmetic.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'SEK' check (char_length(currency) = 3),
  -- who paid
  paid_by uuid not null references public.members(id) on delete cascade,
  -- who it was for, shared equally (the adults by default)
  split_among uuid[] not null check (cardinality(split_among) > 0),
  spent_on date not null default current_date,
  settlement boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_family on public.expenses (family_id, spent_on desc);

alter table public.expenses enable row level security;

create policy "family all" on public.expenses for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));

-- Live updates when the other parent logs one.
alter publication supabase_realtime add table public.expenses;
