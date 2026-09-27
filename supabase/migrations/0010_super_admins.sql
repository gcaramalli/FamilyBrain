-- Three levels: member, family admin (profiles.role) and Hembrain super admin.
-- Super admins see usage across all families (counts, dates, accounts) through
-- hembrain_stats(), never the families' content (events, notes, lists...).
--
-- Nobody can make themselves super admin through the API: the table has no
-- insert/update policy. Grant it with SQL (Supabase dashboard / connector):
--   insert into public.super_admins (user_id)
--   select id from auth.users where email = '…';

create table public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.super_admins enable row level security;
-- Lets the app know whether to show the Stats page to the signed-in user.
create policy "self read" on public.super_admins for select using (user_id = (select auth.uid()));

create or replace function public.hembrain_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.super_admins s where s.user_id = auth.uid()) then
    raise exception 'not_super_admin' using errcode = '42501';
  end if;

  with activity as (
    -- One row per thing a family created, with its date (content left out).
    select family_id, created_at as at from public.events
    union all select family_id, created_at from public.list_items
    union all select family_id, purchased_at from public.purchases
    union all select family_id, created_at from public.recipes
    union all select family_id, updated_at from public.notes
  ),
  fam as (
    select
      f.id,
      f.name,
      f.created_at,
      (select count(*) from public.profiles p where p.family_id = f.id) as accounts,
      (select count(*) from public.members m where m.family_id = f.id and m.profile_id is null) as without_account,
      (select count(*) from public.events e where e.family_id = f.id) as events,
      (select count(*) from public.list_items li where li.family_id = f.id) as list_items,
      (select count(*) from public.purchases pu where pu.family_id = f.id) as purchases,
      (select count(*) from public.recipes r where r.family_id = f.id) as recipes,
      (select count(*) from public.notes n where n.family_id = f.id) as notes,
      (select count(*) from activity a where a.family_id = f.id and a.at > now() - interval '7 days') as added_7d,
      (select count(*) from activity a where a.family_id = f.id and a.at > now() - interval '30 days') as added_30d,
      greatest(
        (select max(a.at) from activity a where a.family_id = f.id),
        (select max(u.last_sign_in_at) from auth.users u join public.profiles p on p.id = u.id where p.family_id = f.id)
      ) as last_active,
      (select max(ct.last_used_at) from public.connector_tokens ct join public.profiles p on p.id = ct.profile_id where p.family_id = f.id) as claude_last_used
    from public.families f
  )
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'families', (select count(*) from public.families),
      'accounts', (select count(*) from public.profiles),
      'without_account', (select count(*) from public.members where profile_id is null),
      'events', (select count(*) from public.events),
      'list_items', (select count(*) from public.list_items),
      'purchases', (select count(*) from public.purchases),
      'recipes', (select count(*) from public.recipes),
      'notes', (select count(*) from public.notes),
      'added_7d', (select count(*) from activity where at > now() - interval '7 days'),
      'active_families_7d', (select count(*) from fam where last_active > now() - interval '7 days'),
      'claude_families_30d', (select count(*) from fam where claude_last_used > now() - interval '30 days'),
      'push_devices', (select count(*) from public.push_subscriptions)
    ),
    'families', coalesce((select jsonb_agg(to_jsonb(fam) order by fam.last_active desc nulls last) from fam), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'display_name', p.display_name,
        'email', p.email,
        'role', p.role,
        'family', f.name,
        'created_at', p.created_at,
        'last_sign_in_at', u.last_sign_in_at
      ) order by p.created_at desc)
      from public.profiles p
      join public.families f on f.id = p.family_id
      left join auth.users u on u.id = p.id
    ), '[]'::jsonb),
    'signups_by_week', coalesce((
      select jsonb_agg(jsonb_build_object('week', w.week, 'accounts', w.n) order by w.week)
      from (
        select date_trunc('week', created_at)::date as week, count(*) as n
        from public.profiles
        where created_at > now() - interval '12 weeks'
        group by 1
      ) w
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.hembrain_stats() from public, anon;
grant execute on function public.hembrain_stats() to authenticated;
