-- Private space: each account's own tiles (to-dos, notes, gift ideas, work...),
-- seen by nobody else, not even the other parent or the family admin.
-- Deliberately separate from lists/notes: those are shared by the family and
-- read by the Claude connector; these are not.
create table public.private_boards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  emoji text not null default '📝' check (char_length(emoji) <= 16),
  -- list = checkable items; note = free text in body
  kind text not null default 'list' check (kind in ('list', 'note')),
  body text not null default '' check (char_length(body) <= 20000),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index private_boards_owner on public.private_boards (profile_id, position);
create index private_boards_family on public.private_boards (family_id);

create table public.private_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.private_boards(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index private_items_board on public.private_items (board_id, created_at);
create index private_items_owner on public.private_items (profile_id);

alter table public.private_boards enable row level security;
alter table public.private_items enable row level security;

create policy "owner all" on public.private_boards for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));

-- Items only go into one of my own boards.
create policy "owner all" on public.private_items for all
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.private_boards b where b.id = board_id and b.profile_id = (select auth.uid()))
  );
