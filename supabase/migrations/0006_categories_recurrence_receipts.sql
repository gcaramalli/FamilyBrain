-- Groceries: aisle/category per item.
alter table public.list_items add column category text;

-- Calendar: simple recurrence (edits apply to the whole series).
alter table public.events
  add column recurrence text check (recurrence in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly')),
  add column recurrence_until date;
create index events_recurring on public.events (family_id) where recurrence is not null;

-- Receipts: where and for how much.
alter table public.purchases
  add column store text,
  add column price numeric(10, 2);

-- Don't log the same item twice within a few minutes (e.g. a receipt logs the
-- purchase, then checks the item off the list; or an item is re-checked).
create or replace function public.log_purchase_on_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done and not coalesce(old.done, false)
     and exists (select 1 from public.lists l where l.id = new.list_id and l.kind = 'grocery')
     and not exists (
       select 1 from public.purchases p
       where p.family_id = new.family_id
         and p.item_key = lower(trim(new.title))
         and p.purchased_at > now() - interval '10 minutes'
     ) then
    insert into public.purchases (family_id, item_name, quantity, source, created_by)
    values (new.family_id, new.title, new.quantity, 'list', coalesce(auth.uid(), new.created_by));
  end if;
  return new;
end;
$$;

revoke all on function public.log_purchase_on_check() from public, anon, authenticated;

-- Applied with a one-off backfill of existing shopping items' categories.
