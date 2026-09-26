-- Kids tab: who drops off / picks up each child, planned ahead.
-- Usual times and place live on the child's member row; each drop-off or
-- pick-up is a regular calendar event tagged with `care`.
alter table public.members
  add column dropoff_time time,
  add column pickup_time time,
  add column care_place text,
  -- Days the child goes to preschool/school (ISO weekday, Monday = 1).
  add column care_days smallint[] not null default '{1,2,3,4,5}';

alter table public.events
  add column care text check (care in ('dropoff', 'pickup')),
  -- Occurrences of a repeating event deleted or changed on their own
  -- ("this time only"); a changed occurrence becomes a separate one-off event.
  add column skip_dates date[] not null default '{}';
create index events_care on public.events (family_id, for_member_id, starts_at) where care is not null;

-- Language of the app, per account.
alter table public.profiles
  add column locale text not null default 'en' check (locale in ('en', 'fr', 'sv'));

-- Web push: one row per device that allowed notifications.
create table public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile on public.push_subscriptions (profile_id);
create index push_subscriptions_family on public.push_subscriptions (family_id);

alter table public.push_subscriptions enable row level security;

create policy "own devices read" on public.push_subscriptions for select
  using (profile_id = (select auth.uid()));
create policy "own devices add" on public.push_subscriptions for insert
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "own devices update" on public.push_subscriptions for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "own devices delete" on public.push_subscriptions for delete
  using (profile_id = (select auth.uid()));
