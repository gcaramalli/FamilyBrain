-- Work space, round two.
-- not_before: an item stays off agendas until that day, so what is decided
-- at the end of a meeting ("next week we talk about X") waits for the next one.
-- notes on people and projects: who does what, so Claude can file things
-- ("the budget question" → the person who owns the budget).
alter table public.work_items add column not_before date;
alter table public.work_people add column notes text not null default '' check (char_length(notes) <= 2000);
alter table public.work_projects add column notes text not null default '' check (char_length(notes) <= 2000);

-- History: recently done items are read back (last weeks), by done_at.
create index work_items_done on public.work_items (profile_id, done_at) where status = 'done';
