-- Kids tab: before someone commits to a drop-off or pick-up, each parent says
-- whether they can (available = true) or can't (false). No row = hasn't said.
-- The one who actually goes is still the event's responsible_member_id, set
-- when they confirm ("I'm going").
create table public.care_availability (
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  kid_id uuid not null references public.members(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('dropoff', 'pickup')),
  member_id uuid not null references public.members(id) on delete cascade,
  available boolean not null,
  updated_at timestamptz not null default now(),
  primary key (kid_id, day, kind, member_id)
);
create index care_availability_family on public.care_availability (family_id, day);

alter table public.care_availability enable row level security;
create policy "family all" on public.care_availability for all
  using (family_id = (select private.my_family_id()))
  with check (family_id = (select private.my_family_id()));

alter publication supabase_realtime add table public.care_availability;
