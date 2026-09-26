@AGENTS.md

# Caramalli Family Brain — notes for Claude

Family app for **Guillaume** (dad, admin), **Jenny** (mom) and **Charlie** (baby/toddler, no account).
Next.js 16 + Supabase. All data lives in Supabase Postgres; every table is scoped by `family_id` and
protected by RLS (`public.my_family_id()`).

## Adding things for the family (via Supabase SQL / MCP)

When you run SQL with the Supabase connector you are **not** a signed-in user, so `auth.uid()` is null:
always set `family_id` explicitly and look people up by name.

```sql
-- Family id and people
select id, name from families;
select id, name, profile_id from members;          -- Guillaume, Jenny, Charlie

-- "Jenny picks up Charlie at the förskola on Thursday 16:00"
insert into events (family_id, title, starts_at, ends_at, location, responsible_member_id, for_member_id)
select f.id, 'Pick up Charlie', '2026-10-01 16:00 Europe/Stockholm', '2026-10-01 16:30 Europe/Stockholm',
       'Förskolan …',
       (select id from members where name ilike 'jenny%'),
       (select id from members where name ilike 'charlie%')
from families f limit 1;

-- Add to the shopping list
insert into list_items (family_id, list_id, title, quantity)
select l.family_id, l.id, 'Toothpaste', '1' from lists l where l.kind = 'grocery' order by position limit 1;

-- Log a purchase made outside the list (feeds the restock prediction)
insert into purchases (family_id, item_name, source) select id, 'Toothpaste', 'manual' from families limit 1;

-- What's probably running out
select item_name, next_due_on, avg_interval_days from restock_suggestions order by next_due_on;

-- Family facts to read before answering (pickup rules, addresses, allergies…)
select title, body from notes order by pinned desc, updated_at desc;
```

Rules of thumb:
- Times are Europe/Stockholm unless told otherwise; store as `timestamptz`.
- Check `notes` for context (e.g. the kindergarten address) before inventing a location.
- Don't delete rows unless explicitly asked.

## Schema (see `supabase/migrations/0001_init.sql`)

- `families`, `profiles` (one per account, `role` admin/member), `members` (everyone, incl. Charlie), `invites`
- `events` — calendar; `responsible_member_id` = who does it, `for_member_id` = who it's about
- `lists` (`kind` grocery/todo) and `list_items`
- `purchases` — auto-filled by a trigger when a grocery item is checked off; `source` list/manual/receipt
- `restock_suggestions` — view: average interval between purchases → `next_due_on` (needs ≥2 purchases)
- `recipes` — `ingredients text[]`, `tags text[]`, `favorite`, `kid_friendly`
- `notes` — the family brain

## Dev

- `npm run dev`, `npm run lint`, `npm run build`
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`)
- Pages under `src/app/(app)` are client components talking to Supabase directly (RLS is the security
  boundary). New tables need RLS + a `family all` policy like the existing ones.
- Schema changes: add a new numbered file in `supabase/migrations/`, never edit an applied one.
