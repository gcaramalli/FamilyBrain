-- The kid tab becomes a set of tiles: preschool (the drop-off / pick-up
-- planner), wardrobe, sleep and food, plus the family's own list and note
-- tiles. Shared by the family like the rest of the kid tab (not private).

-- Wardrobe: the kid's current sizes, kept on the member.
alter table public.members
  add column clothing_size text check (char_length(clothing_size) <= 20),
  add column shoe_size text check (char_length(shoe_size) <= 20),
  add column sizes_updated_on date;

-- Clothes the kid has, needs, or has grown out of.
create table public.kid_clothes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  kid_id uuid not null references public.members(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- ids in src/lib/wardrobe.ts
  category text not null default 'other'
    check (category in ('base', 'sleep', 'tops', 'bottoms', 'outerwear', 'rain', 'shoes', 'accessories', 'other')),
  size text check (char_length(size) <= 20),
  -- have = in the drawer; need = to buy; outgrown = too small (to store or give away)
  status text not null default 'have' check (status in ('have', 'need', 'outgrown')),
  notes text check (char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kid_clothes_kid on public.kid_clothes (kid_id, status);
create index kid_clothes_family on public.kid_clothes (family_id);

-- Sleep log: naps and nights. ends_at null = asleep right now.
create table public.kid_sleep (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  kid_id uuid not null references public.members(id) on delete cascade,
  kind text not null default 'nap' check (kind in ('nap', 'night')),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at > starts_at),
  -- Night wakings, counted; details go in notes.
  wakings smallint not null default 0 check (wakings between 0 and 30),
  notes text check (char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index kid_sleep_kid on public.kid_sleep (kid_id, starts_at desc);
create index kid_sleep_family on public.kid_sleep (family_id);

-- The family's own tiles on the kid tab: a checklist or a note
-- (vaccinations, activities, words he says…).
create table public.kid_boards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  kid_id uuid not null references public.members(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  emoji text not null default '📝' check (char_length(emoji) <= 16),
  kind text not null default 'list' check (kind in ('list', 'note')),
  body text not null default '' check (char_length(body) <= 20000),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kid_boards_kid on public.kid_boards (kid_id, position);
create index kid_boards_family on public.kid_boards (family_id);

create table public.kid_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.my_family_id() references public.families(id) on delete cascade,
  board_id uuid not null references public.kid_boards(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index kid_items_board on public.kid_items (board_id, created_at);
create index kid_items_family on public.kid_items (family_id);

-- Food: how the kid took a meal (meals journal, Food tile).
alter table public.meals
  add column reaction text check (reaction in ('loved', 'ok', 'refused'));

alter table public.kid_clothes enable row level security;
alter table public.kid_sleep enable row level security;
alter table public.kid_boards enable row level security;
alter table public.kid_items enable row level security;

-- Family-wide, and rows only point at a kid (or board) of my own family.
create policy "family all" on public.kid_clothes for all
  using (family_id = (select private.my_family_id()))
  with check (
    family_id = (select private.my_family_id())
    and exists (select 1 from public.members m where m.id = kid_id and m.family_id = (select private.my_family_id()))
  );
create policy "family all" on public.kid_sleep for all
  using (family_id = (select private.my_family_id()))
  with check (
    family_id = (select private.my_family_id())
    and exists (select 1 from public.members m where m.id = kid_id and m.family_id = (select private.my_family_id()))
  );
create policy "family all" on public.kid_boards for all
  using (family_id = (select private.my_family_id()))
  with check (
    family_id = (select private.my_family_id())
    and exists (select 1 from public.members m where m.id = kid_id and m.family_id = (select private.my_family_id()))
  );
create policy "family all" on public.kid_items for all
  using (family_id = (select private.my_family_id()))
  with check (
    family_id = (select private.my_family_id())
    and exists (select 1 from public.kid_boards b where b.id = board_id and b.family_id = (select private.my_family_id()))
  );

-- Both parents see a nap start or end on the other's phone.
alter publication supabase_realtime add table public.kid_sleep;
