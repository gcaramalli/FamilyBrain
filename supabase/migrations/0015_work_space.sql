-- Private space, work: one account's own work organiser. People at work
-- (boss, peers, team), projects linked to people, recurring meetings with
-- their attendees, and the items to do / hand over / discuss with them.
-- Owner-only like private_boards. The Claude connector reads and writes it
-- only for the account whose personal link is used (never the legacy token).

alter table public.private_boards drop constraint private_boards_kind_check;
alter table public.private_boards add constraint private_boards_kind_check check (kind in ('list', 'note', 'gifts', 'work'));

create table public.work_people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text not null default 'team' check (role in ('boss', 'peer', 'team', 'other')),
  created_at timestamptz not null default now()
);
create index work_people_owner on public.work_people (profile_id);

create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  person_ids uuid[] not null default '{}', -- work_people involved
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index work_projects_owner on public.work_projects (profile_id);

create table public.work_meetings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  weekday smallint check (weekday between 1 and 7), -- ISO, null = no fixed day
  person_ids uuid[] not null default '{}', -- attendees (work_people)
  created_at timestamptz not null default now()
);
create index work_meetings_owner on public.work_meetings (profile_id);

-- kind: todo = I do it, give = hand it to the person, discuss = bring it up with them.
-- status: open → waiting (handed over, waiting on the person) → done.
create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  kind text not null default 'todo' check (kind in ('todo', 'give', 'discuss')),
  status text not null default 'open' check (status in ('open', 'waiting', 'done')),
  person_id uuid references public.work_people(id) on delete set null,
  project_id uuid references public.work_projects(id) on delete set null,
  meeting_id uuid references public.work_meetings(id) on delete set null,
  due_date date,
  waiting_since timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index work_items_owner on public.work_items (profile_id, status);

alter table public.work_people enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_meetings enable row level security;
alter table public.work_items enable row level security;

create policy "owner all" on public.work_people for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "owner all" on public.work_projects for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "owner all" on public.work_meetings for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and family_id = (select private.my_family_id()));

-- Items only point at my own people, projects and meetings.
create policy "owner all" on public.work_items for all
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and family_id = (select private.my_family_id())
    and (person_id is null or exists (select 1 from public.work_people p where p.id = person_id and p.profile_id = (select auth.uid())))
    and (project_id is null or exists (select 1 from public.work_projects p where p.id = project_id and p.profile_id = (select auth.uid())))
    and (meeting_id is null or exists (select 1 from public.work_meetings m where m.id = meeting_id and m.profile_id = (select auth.uid())))
  );
