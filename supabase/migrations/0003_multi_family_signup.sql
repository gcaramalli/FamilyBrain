-- Multi-family self sign-up.
-- * Anyone can sign up and create a family (family name + their name in the
--   sign-up metadata).
-- * Joining an existing family requires a secret invite code (shared as a
--   link), not just a matching email: email confirmation is off, so an email
--   alone proves nothing.

alter table public.invites
  add column code text not null default replace(gen_random_uuid()::text, '-', ''),
  add column expires_at timestamptz not null default now() + interval '14 days';
create unique index invites_code on public.invites (code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  invite_code text := nullif(trim(meta->>'invite_code'), '');
  display text := coalesce(nullif(trim(meta->>'display_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Me');
  fam_name text := coalesce(nullif(trim(meta->>'family_name'), ''), 'Our family');
  inv public.invites%rowtype;
  fam uuid;
  r text;
  placeholder uuid;
begin
  if invite_code is not null then
    select * into inv from public.invites i where i.code = invite_code and i.expires_at > now();
    if not found then
      raise exception 'invalid_invite' using hint = 'This invite link is invalid or has expired.';
    end if;
    fam := inv.family_id;
    r := inv.role;
    delete from public.invites i where i.code = inv.code;
  else
    insert into public.families (name) values (fam_name) returning id into fam;
    r := 'admin';
    insert into public.lists (family_id, name, kind, position) values
      (fam, 'Groceries', 'grocery', 0),
      (fam, 'To-do', 'todo', 1);
  end if;

  insert into public.profiles (id, family_id, display_name, email, role)
  values (new.id, fam, display, new.email, r);

  -- Reuse a member an admin already created for this person (same name, no
  -- account yet) so their calendar history stays attached.
  select id into placeholder from public.members
  where family_id = fam and profile_id is null and lower(name) = lower(display)
  order by created_at limit 1;
  if placeholder is not null then
    update public.members set profile_id = new.id where id = placeholder;
  else
    insert into public.members (family_id, profile_id, name) values (fam, new.id, display);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
