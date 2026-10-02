-- Work space: tabs (people / projects / meetings) an account has chosen to
-- hide. Only hides them from view; the data stays and the connector still
-- reaches it. Written by the account itself (profiles "self update" policy).
alter table public.profiles
  add column work_hidden_tabs text[] not null default '{}'
  check (work_hidden_tabs <@ array['people', 'projects', 'meetings']);
