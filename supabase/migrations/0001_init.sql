-- Caramalli Family Brain — initial schema
-- Everything is scoped to a family. Row Level Security ensures a signed-in
-- user can only see rows belonging to their own family.

-- ---------------------------------------------------------------------------
-- Families & people
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  created_at timestamptz not null default now()
);

-- One row per signed-in user (Guillaume, Jenny).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null default '',
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- Every person in the family, with or without an account (Charlie has none).
create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  emoji text not null default '🙂',
  color text not null default '#6366f1',
  birthdate date,
  notes text,
  created_at timestamptz not null default now()
);

-- Emails allowed to join a family. When that email signs up, it is attached
-- to the family automatically (see handle_new_user below).
create table public.invites (
  email text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- Returns the family of the current user. SECURITY DEFINER avoids RLS
-- recursion when policies on profiles need to look at profiles.
create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_family_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- On signup: join the family you were invited to, otherwise create a new
-- family and become its admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  fam uuid;
  r text;
  display text := coalesce(nullif(split_part(new.email, '@', 1), ''), 'Me');
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  if found then
    fam := inv.family_id;
    r := inv.role;
    delete from public.invites where email = inv.email;
  else
    insert into public.families (name) values ('Our family') returning id into fam;
    r := 'admin';
    insert into public.lists (family_id, name, kind, position) values
      (fam, 'Groceries', 'grocery', 0),
      (fam, 'To-do', 'todo', 1);
  end if;

  insert into public.profiles (id, family_id, display_name, email, role)
  values (new.id, fam, display, new.email, r);

  insert into public.members (family_id, profile_id, name)
  values (fam, new.id, display);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  notes text,
  -- Who is responsible (e.g. "Jenny picks up Charlie").
  responsible_member_id uuid references public.members(id) on delete set null,
  -- Who the event is about (e.g. Charlie).
  for_member_id uuid references public.members(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index events_family_starts on public.events (family_id, starts_at);

-- ---------------------------------------------------------------------------
-- Shared lists (groceries, to-dos)
-- ---------------------------------------------------------------------------

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  kind text not null default 'todo' check (kind in ('grocery', 'todo')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  quantity text,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null,
  due_date date,
  assignee_member_id uuid references public.members(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index list_items_list on public.list_items (list_id, done, created_at);

-- Purchase history: the raw material for "time to buy toothpaste again".
-- Filled automatically when a grocery item is checked off, and later by
-- receipts (Kivra, email, photos...).
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  item_name text not null,
  item_key text generated always as (lower(trim(item_name))) stored,
  quantity text,
  purchased_at timestamptz not null default now(),
  source text not null default 'list' check (source in ('list', 'manual', 'receipt')),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);
create index purchases_family_key on public.purchases (family_id, item_key, purchased_at);

create or replace function public.log_purchase_on_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done and not coalesce(old.done, false)
     and exists (select 1 from public.lists l where l.id = new.list_id and l.kind = 'grocery') then
    insert into public.purchases (family_id, item_name, quantity, source, created_by)
    values (new.family_id, new.title, new.quantity, 'list', auth.uid());
  end if;
  return new;
end;
$$;

create trigger list_items_log_purchase
  after update of done on public.list_items
  for each row execute function public.log_purchase_on_check();

-- Simple, non-AI restock estimate: average gap between purchases of the same
-- item, projected from the last purchase. Needs at least 2 purchases.
-- A smarter agent can replace or complement this later.
create or replace view public.restock_suggestions
with (security_invoker = true) as
with gaps as (
  select
    family_id,
    item_key,
    item_name,
    purchased_at,
    purchased_at - lag(purchased_at) over (partition by family_id, item_key order by purchased_at) as gap
  from public.purchases
),
agg as (
  select
    family_id,
    item_key,
    (array_agg(item_name order by purchased_at desc))[1] as item_name,
    count(*) as times_bought,
    max(purchased_at) as last_bought_at,
    avg(extract(epoch from gap)) filter (where gap is not null) / 86400.0 as avg_interval_days
  from gaps
  group by family_id, item_key
)
select
  family_id,
  item_key,
  item_name,
  times_bought,
  last_bought_at,
  round(avg_interval_days::numeric, 1) as avg_interval_days,
  (last_bought_at + make_interval(secs => avg_interval_days * 86400))::date as next_due_on
from agg
where times_bought >= 2 and avg_interval_days >= 1;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  description text,
  -- One ingredient per line, e.g. "2 carrots".
  ingredients text[] not null default '{}',
  steps text,
  tags text[] not null default '{}',
  prep_minutes int,
  servings int,
  source_url text,
  favorite boolean not null default false,
  kid_friendly boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Family brain: free-form facts the app and Claude can use as context
-- (kindergarten address, pickup rules, allergies, doctor, Wi-Fi...).
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.events enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.purchases enable row level security;
alter table public.recipes enable row level security;
alter table public.notes enable row level security;

create policy "family read" on public.families for select using (id = public.my_family_id());
create policy "admin update" on public.families for update using (id = public.my_family_id() and public.is_family_admin());

create policy "family read" on public.profiles for select using (family_id = public.my_family_id());
create policy "self update" on public.profiles for update using (id = auth.uid())
  -- Members may edit their own profile but not promote themselves to admin.
  with check (family_id = public.my_family_id() and (role = 'member' or public.is_family_admin()));
create policy "admin update" on public.profiles for update using (family_id = public.my_family_id() and public.is_family_admin());

create policy "admin all" on public.invites for all
  using (family_id = public.my_family_id() and public.is_family_admin())
  with check (family_id = public.my_family_id() and public.is_family_admin());

-- Shared family data: every family member can read and write.
do $$
declare t text;
begin
  foreach t in array array['members', 'events', 'lists', 'list_items', 'purchases', 'recipes', 'notes'] loop
    execute format(
      'create policy "family all" on public.%I for all using (family_id = public.my_family_id()) with check (family_id = public.my_family_id())',
      t
    );
  end loop;
end $$;

-- Let the app omit family_id on insert: it defaults to the caller's family.
-- (When inserting as a service/SQL user — e.g. Claude via the Supabase
-- connector — auth.uid() is null, so pass family_id explicitly.)
do $$
declare t text;
begin
  foreach t in array array['members', 'events', 'lists', 'list_items', 'purchases', 'recipes', 'notes'] loop
    execute format('alter table public.%I alter column family_id set default public.my_family_id()', t);
  end loop;
end $$;

-- Live updates on the phone when the other parent edits a list or the calendar.
alter publication supabase_realtime add table public.list_items, public.events;
