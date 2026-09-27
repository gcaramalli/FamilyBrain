-- Meals journal: what the family actually ate. Feeds balanced suggestions
-- ("fish once in two weeks, lots of pasta") and, later, shopping predictions
-- from eating habits. Logged mostly through Claude (log_meal).
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  eaten_on date not null default (now() at time zone 'Europe/Stockholm')::date,
  slot text not null default 'dinner' check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text not null check (char_length(title) <= 200),
  recipe_id uuid references public.recipes(id) on delete set null,
  -- Food groups on the plate (ids in src/lib/meals.ts: vegetables, fish, red_meat…).
  food_groups text[] not null default '{}',
  -- Home-cooked meals use groceries; eating out does not.
  place text not null default 'home' check (place in ('home', 'out', 'takeaway')),
  -- Who ate it; empty = the whole family.
  member_ids uuid[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index meals_family_day on public.meals (family_id, eaten_on desc);
create index meals_recipe on public.meals (recipe_id) where recipe_id is not null;

alter table public.meals enable row level security;
create policy "family all" on public.meals for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));
