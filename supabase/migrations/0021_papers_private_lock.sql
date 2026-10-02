-- Papers: the family's contracts, insurance, warranties and IDs, kept with the
-- dates that matter (renewal, notice period, expiry, end of warranty) so the
-- app warns before them and Claude can review them. Shared with the family
-- (profile_id null) or private to one account (profile_id set). The scanned
-- document itself, if any, lives in the private "papers" storage bucket.
--
-- Also: private tiles can be locked behind a code (see the end of the file).

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  -- null = the whole family sees it; set = only this account does.
  profile_id uuid references public.profiles(id) on delete cascade,
  -- ids in src/lib/papers.ts
  category text not null default 'other'
    check (category in ('insurance', 'housing', 'energy', 'telecom', 'loan', 'bank', 'vehicle', 'subscription', 'health', 'work', 'tax', 'identity', 'warranty', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  provider text check (char_length(provider) <= 200),
  -- policy, contract, customer or document number
  reference text check (char_length(reference) <= 200),
  -- who it covers or concerns; empty = the whole household
  member_ids uuid[] not null default '{}',
  amount numeric(12, 2) check (amount >= 0),
  currency text not null default 'SEK' check (char_length(currency) = 3),
  period text check (period in ('month', 'quarter', 'year', 'once')),
  starts_on date,
  -- next renewal or end of the binding period; rolled forward by period in src/lib/papers.ts
  renews_on date,
  -- uppsägningstid: last day to cancel = renews_on - notice_days
  notice_days int check (notice_days between 0 and 730),
  -- IDs, fixed-term contracts
  expires_on date,
  -- receipts kept as proof of warranty (reklamationsrätt: 3 years in Sweden)
  warranty_until date,
  -- what it covers, in plain words
  summary text check (char_length(summary) <= 4000),
  -- key terms as read from the document: {"Självrisk": "1 500 kr", ...}
  details jsonb not null default '{}'::jsonb,
  -- storage path in the "papers" bucket: <family_id>/<paper_id>/<file name>
  file_path text check (char_length(file_path) <= 500),
  file_name text check (char_length(file_name) <= 200),
  -- cancelled / replaced: kept for the record, no more reminders
  ended boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index papers_family on public.papers (family_id, category);
create index papers_owner on public.papers (profile_id) where profile_id is not null;

alter table public.papers enable row level security;

-- The family's papers, plus my own private ones (never someone else's).
create policy "family or mine" on public.papers for all
  using (family_id = (select private.my_family_id()) and (profile_id is null or profile_id = (select auth.uid())))
  with check (family_id = (select private.my_family_id()) and (profile_id is null or profile_id = (select auth.uid())));

-- Scanned documents. Private bucket: files are read through short-lived
-- signed URLs, and only by people who can see the paper row.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Upload into <my family>/<a paper I can see>/…: the row is created first.
create policy "papers upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
    and exists (select 1 from public.papers p where p.id::text = (storage.foldername(storage.objects.name))[2])
  );
-- Read / replace / delete: under a paper I can see (RLS on papers applies here).
create policy "papers read" on storage.objects for select to authenticated
  using (
    bucket_id = 'papers'
    and exists (select 1 from public.papers p where p.id::text = (storage.foldername(storage.objects.name))[2])
  );
create policy "papers update" on storage.objects for update to authenticated
  using (
    bucket_id = 'papers'
    and exists (select 1 from public.papers p where p.id::text = (storage.foldername(storage.objects.name))[2])
  );
create policy "papers delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'papers'
    and exists (select 1 from public.papers p where p.id::text = (storage.foldername(storage.objects.name))[2])
  );

-- Locked tiles. Private tiles are already invisible to every other account;
-- the code is a curtain against someone holding my unlocked phone, not
-- encryption. The hash sits in the private schema (not exposed by the API)
-- and is only checked by the functions below.
alter table public.private_boards add column locked boolean not null default false;

create table private.pins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  failed smallint not null default 0,
  wait_until timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on private.pins from public, anon, authenticated;

-- Has this account set a code?
create or replace function public.private_pin_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.pins where profile_id = auth.uid());
$$;

-- Set or change the code (4 to 8 digits).
create or replace function public.private_pin_set(pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if pin !~ '^[0-9]{4,8}$' then raise exception 'The code is 4 to 8 digits.' using errcode = '22023'; end if;
  insert into private.pins (profile_id, pin_hash)
  values (auth.uid(), extensions.crypt(pin, extensions.gen_salt('bf')))
  on conflict (profile_id) do update set pin_hash = excluded.pin_hash, failed = 0, wait_until = null, updated_at = now();
end;
$$;

-- 'ok', 'wrong', or 'wait' (5 wrong codes in a row → 5 minutes' pause).
create or replace function public.private_pin_check(pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec private.pins;
begin
  select * into rec from private.pins where profile_id = auth.uid();
  if not found then return 'ok'; end if;
  if rec.wait_until is not null and rec.wait_until > now() then return 'wait'; end if;
  if rec.pin_hash = extensions.crypt(pin, rec.pin_hash) then
    update private.pins set failed = 0, wait_until = null where profile_id = auth.uid();
    return 'ok';
  end if;
  update private.pins
    set failed = case when rec.failed + 1 >= 5 then 0 else rec.failed + 1 end,
        wait_until = case when rec.failed + 1 >= 5 then now() + interval '5 minutes' else null end
    where profile_id = auth.uid();
  return case when rec.failed + 1 >= 5 then 'wait' else 'wrong' end;
end;
$$;

-- Remove the code (the app asks for the code, or the account password if forgotten).
create or replace function public.private_pin_clear()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.pins where profile_id = auth.uid();
$$;

revoke all on function public.private_pin_status() from public, anon;
revoke all on function public.private_pin_set(text) from public, anon;
revoke all on function public.private_pin_check(text) from public, anon;
revoke all on function public.private_pin_clear() from public, anon;
grant execute on function public.private_pin_status() to authenticated;
grant execute on function public.private_pin_set(text) to authenticated;
grant execute on function public.private_pin_check(text) to authenticated;
grant execute on function public.private_pin_clear() to authenticated;
