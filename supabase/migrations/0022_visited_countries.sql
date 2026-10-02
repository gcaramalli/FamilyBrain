-- Travels: the countries each member of the family has been to (Today → Travels
-- map). One row per person and country, ISO 3166-1 alpha-2 code ("SE"; "XK" for
-- Kosovo); names are translated in the app. First slice of "Places" (VISION.md).
create table public.visited_countries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Optional: the first time there, and a word about it ("honeymoon", "England only").
  first_year int check (first_year between 1900 and 2100),
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (member_id, country)
);
create index visited_countries_family on public.visited_countries (family_id);

alter table public.visited_countries enable row level security;
create policy "family all" on public.visited_countries for all
  using (family_id = (select private.my_family_id()))
  with check (
    family_id = (select private.my_family_id())
    and member_id in (select id from public.members where family_id = (select private.my_family_id()))
  );
