-- Settings menu extras: feedback to Hembrain's owner, and a monthly cap on
-- what each family's in-app Claude calls (receipt scan, "type it") may cost.

-- Feedback: anyone signed in can send ideas / bugs; they see their own,
-- super admins see and triage everyone's (through hembrain_feedback()).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'idea' check (kind in ('idea', 'bug', 'other')),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);
create index feedback_created on public.feedback (created_at desc);
alter table public.feedback enable row level security;
create policy "own read" on public.feedback for select
  using (profile_id = (select auth.uid()));
create policy "own insert" on public.feedback for insert
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "super admin triage" on public.feedback for update
  using (exists (select 1 from public.super_admins s where s.user_id = (select auth.uid())));

-- AI plan per family. No row = free plan at the default cap. Only super
-- admins can write it (a family admin must not raise their own cap).
create table public.ai_budgets (
  family_id uuid primary key references public.families(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  monthly_limit_usd numeric(8, 2) not null default 1 check (monthly_limit_usd >= 0),
  updated_at timestamptz not null default now()
);
alter table public.ai_budgets enable row level security;
create policy "family read" on public.ai_budgets for select
  using (family_id = (select private.my_family_id()));
create policy "super admin write" on public.ai_budgets for all
  using (exists (select 1 from public.super_admins s where s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.super_admins s where s.user_id = (select auth.uid())));

-- One row per Claude API call, written by the server (service role) after
-- the call; the family can read its own to see how much is left.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_family_month on public.ai_usage (family_id, created_at desc);
alter table public.ai_usage enable row level security;
create policy "family read" on public.ai_usage for select
  using (family_id = (select private.my_family_id()));

-- Super admin: every family's feedback with who sent it.
create or replace function public.hembrain_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.super_admins s where s.user_id = auth.uid()) then
    raise exception 'not_super_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fb.id,
      'kind', fb.kind,
      'body', fb.body,
      'status', fb.status,
      'created_at', fb.created_at,
      'author', p.display_name,
      'email', p.email,
      'family', f.name
    ) order by fb.created_at desc)
    from public.feedback fb
    left join public.profiles p on p.id = fb.profile_id
    left join public.families f on f.id = fb.family_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.hembrain_feedback() from public, anon;
grant execute on function public.hembrain_feedback() to authenticated;

-- Super admin: each family's plan, cap and Claude spend this month and last.
create or replace function public.hembrain_ai_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
begin
  if not exists (select 1 from public.super_admins s where s.user_id = auth.uid()) then
    raise exception 'not_super_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.month_usd desc, x.name)
    from (
      select
        f.id,
        f.name,
        coalesce(b.plan, 'free') as plan,
        coalesce(b.monthly_limit_usd, 1) as limit_usd,
        coalesce((select sum(u.cost_usd) from public.ai_usage u where u.family_id = f.id and u.created_at >= month_start), 0) as month_usd,
        (select count(*) from public.ai_usage u where u.family_id = f.id and u.created_at >= month_start) as month_calls,
        coalesce((select sum(u.cost_usd) from public.ai_usage u where u.family_id = f.id and u.created_at >= month_start - interval '1 month' and u.created_at < month_start), 0) as last_month_usd,
        (select max(u.created_at) from public.ai_usage u where u.family_id = f.id) as last_call
      from public.families f
      left join public.ai_budgets b on b.family_id = f.id
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.hembrain_ai_usage() from public, anon;
grant execute on function public.hembrain_ai_usage() to authenticated;
