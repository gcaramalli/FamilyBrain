-- Work space: priority items go first everywhere (Me view, person, project,
-- meeting agenda). "!" in the quick capture sets it.
alter table public.work_items add column priority boolean not null default false;
