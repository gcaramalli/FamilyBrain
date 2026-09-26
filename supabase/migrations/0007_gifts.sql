-- Little gifts between family members ("à toi, à moi"): an emoji and an
-- optional short note, unwrapped by the recipient next time they open the app.
-- Private to sender and recipient.

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  from_profile uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_profile uuid not null references public.profiles(id) on delete cascade,
  emoji text not null default '🎁' check (char_length(emoji) <= 16),
  message text check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  check (from_profile <> to_profile)
);
create index gifts_to_unopened on public.gifts (to_profile) where opened_at is null;
create index gifts_family on public.gifts (family_id);
create index gifts_from on public.gifts (from_profile);

alter table public.gifts enable row level security;

create policy "sender or recipient read" on public.gifts for select
  using (from_profile = (select auth.uid()) or to_profile = (select auth.uid()));

-- Send only as yourself, only to someone in your own family.
create policy "send in family" on public.gifts for insert
  with check (
    from_profile = (select auth.uid())
    and family_id = (select private.my_family_id())
    and exists (select 1 from public.profiles p where p.id = to_profile and p.family_id = (select private.my_family_id()))
  );

-- Only the recipient can unwrap.
create policy "recipient opens" on public.gifts for update
  using (to_profile = (select auth.uid()))
  with check (to_profile = (select auth.uid()));

create policy "sender deletes" on public.gifts for delete
  using (from_profile = (select auth.uid()));

alter publication supabase_realtime add table public.gifts;
