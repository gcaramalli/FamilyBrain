-- Travels timeline: each trip (or a stretch lived somewhere) with the month,
-- the country and who went. A trip ticks the country on the travellers' map
-- (visited_countries) and keeps its first_year to the earliest trip.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Month precision: the first day of the month. Null start = year unknown.
  start_month date check (extract(day from start_month) = 1),
  end_month date check (extract(day from end_month) = 1 and end_month >= start_month),
  -- Lived there rather than visited (studies, residence).
  lived boolean not null default false,
  note text check (char_length(note) <= 500),
  member_ids uuid[] not null check (cardinality(member_ids) > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index trips_family_start on public.trips (family_id, start_month desc);

alter table public.trips enable row level security;
create policy "family all" on public.trips for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));

create function private.trip_ticks_country() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.visited_countries (family_id, member_id, country, first_year)
  select new.family_id, m.id, new.country, extract(year from new.start_month)::int
  from public.members m
  where m.id = any (new.member_ids) and m.family_id = new.family_id
  on conflict (member_id, country) do update
    set first_year = least(public.visited_countries.first_year, excluded.first_year)
    where excluded.first_year is not null;
  return new;
end $$;

create trigger trips_tick_country after insert or update of country, member_ids, start_month on public.trips
  for each row execute function private.trip_ticks_country();
revoke all on function private.trip_ticks_country() from public, anon, authenticated;
