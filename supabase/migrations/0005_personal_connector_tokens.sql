-- Personal Claude connector links. Each person creates their own link in the
-- Profile tab; it tells the connector who is talking and (through their
-- profile) which family to use. Only a SHA-256 hash of the secret is stored.

create table public.connector_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Claude',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index connector_tokens_profile on public.connector_tokens (profile_id);

alter table public.connector_tokens enable row level security;

create policy "own tokens read" on public.connector_tokens for select
  using (profile_id = (select auth.uid()));
create policy "own tokens create" on public.connector_tokens for insert
  with check (profile_id = (select auth.uid()));
create policy "own tokens delete" on public.connector_tokens for delete
  using (profile_id = (select auth.uid()));
