-- Sign-up asks for the person's date of birth (optional): it goes on their
-- member card, so the family calendar shows it and the others are reminded
-- the evening before. Same function as 0004, plus the birthdate.

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
  -- Optional date of birth from the sign-up form; anything malformed or in
  -- the future is ignored rather than blocking the sign-up.
  bday date;
begin
  begin
    bday := nullif(trim(meta->>'birthdate'), '')::date;
  exception when others then
    bday := null;
  end;
  if bday is not null and (bday > current_date or bday < date '1900-01-01') then
    bday := null;
  end if;
  if invite_code is not null then
    select * into inv from public.invites i where i.code = invite_code and i.expires_at > now();
    if not found then
      raise exception 'invalid_invite' using hint = 'This invite link is invalid or has expired.';
    end if;
  elsif meta->>'family_name' is null then
    -- No sign-up metadata: the account was created by an admin (Supabase
    -- dashboard → Add user, or the admin API). Attach it to the family that
    -- invited this email, if any.
    select * into inv from public.invites i
    where lower(i.email) = lower(new.email) and i.expires_at > now()
    order by i.created_at desc limit 1;
  end if;

  if inv.code is not null then
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

  -- The invite may name the member card this account is for.
  if inv.member_id is not null then
    select id into placeholder from public.members
    where id = inv.member_id and family_id = fam and profile_id is null;
    if placeholder is not null and nullif(trim(meta->>'display_name'), '') is null then
      select name into display from public.members where id = placeholder;
    end if;
  end if;

  insert into public.profiles (id, family_id, display_name, email, role)
  values (new.id, fam, display, new.email, r);

  -- Reuse a member an admin already created for this person (same name, no
  -- account yet) so their calendar history stays attached.
  if placeholder is null then
    select id into placeholder from public.members
    where family_id = fam and profile_id is null and lower(name) = lower(display)
    order by created_at limit 1;
  end if;
  if placeholder is not null then
    update public.members set profile_id = new.id, birthdate = coalesce(bday, birthdate) where id = placeholder;
  else
    insert into public.members (family_id, profile_id, name, birthdate) values (fam, new.id, display, bday);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
