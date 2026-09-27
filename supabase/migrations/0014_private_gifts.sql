-- Private space, structured gift ideas: a "gifts" tile groups its ideas by
-- who they are for, with an optional occasion (Christmas, birthday…).
-- Free text on purpose: gifts are also for people who are not members.
alter table public.private_boards drop constraint private_boards_kind_check;
alter table public.private_boards add constraint private_boards_kind_check check (kind in ('list', 'note', 'gifts'));

alter table public.private_items
  add column person text check (char_length(person) <= 80),
  add column occasion text check (char_length(occasion) <= 80);

-- Gift tiles made before this change become real gift tiles.
update public.private_boards set kind = 'gifts'
where kind = 'list' and title in ('Gift ideas', 'Idées cadeaux', 'Presentidéer');
