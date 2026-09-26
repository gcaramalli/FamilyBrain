-- Fixes from the Supabase security & performance advisors.

-- 1. Helper functions used by RLS policies must not be callable through the
--    public API (/rest/v1/rpc/...). Move them to a schema PostgREST doesn't
--    expose. Policies and column defaults reference functions by OID, so they
--    keep working without changes.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.my_family_id() set schema private;
alter function public.is_family_admin() set schema private;
revoke all on function private.my_family_id() from public, anon;
revoke all on function private.is_family_admin() from public, anon;
grant execute on function private.my_family_id() to authenticated;
grant execute on function private.is_family_admin() to authenticated;

-- Trigger functions: nobody needs to call them directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_purchase_on_check() from public, anon, authenticated;

-- 2. One UPDATE policy on profiles instead of two, with auth.uid() evaluated
--    once per query instead of once per row.
drop policy "self update" on public.profiles;
drop policy "admin update" on public.profiles;
create policy "self or admin update" on public.profiles for update
  using (
    family_id = (select private.my_family_id())
    and (id = (select auth.uid()) or (select private.is_family_admin()))
  )
  -- Members may edit their own profile but not promote themselves to admin.
  with check (
    family_id = (select private.my_family_id())
    and (role = 'member' or (select private.is_family_admin()))
  );

-- 3. Indexes on family_id for the tables every page filters by.
create index if not exists profiles_family on public.profiles (family_id);
create index if not exists members_family on public.members (family_id);
create index if not exists invites_family on public.invites (family_id);
create index if not exists lists_family on public.lists (family_id, position);
create index if not exists list_items_family on public.list_items (family_id);
create index if not exists recipes_family on public.recipes (family_id);
create index if not exists notes_family on public.notes (family_id);
