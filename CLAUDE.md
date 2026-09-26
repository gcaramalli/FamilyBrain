@AGENTS.md

# Hembrain — notes for Claude

Family app for **Guillaume** (dad, admin), **Jenny** (mom) and **Charlie** (baby/toddler, no account).
Next.js 16 + Supabase. All data lives in Supabase Postgres; every table is scoped by `family_id` and
protected by RLS (`private.my_family_id()`, in a schema the API does not expose).

Supabase project: **Caramalli Familly brain** (`jvzwbguwoafayxmdirnj`, in Jenny's org, eu-west-1). Migrations 0001–0008 are applied. Sign-up is open (multi-family); joining a family needs an invite code (`invites.code`, link `/signup?invite=…`), see `handle_new_user()` in `0004_dashboard_users_join_invited_family.sql` (accounts created from the Supabase dashboard have no metadata and join the family that invited their email). A user's family = `profiles.family_id`.

## Adding things for the family

Preferred: the **Hembrain connector** (`/api/mcp` + bearer header, tools in `src/lib/mcp/tools.ts`) for
the calendar, lists, purchases, recipes and notes (event times are passed as local Stockholm time, see `src/lib/mcp/time.ts`).
Setup and routing prompt: `docs/claude-setup.md`.

Fallback, for maintenance only (full admin access — avoid for day-to-day use): raw SQL via the Supabase connector.

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

## Schema (see `supabase/migrations/`)

- `families`, `profiles` (one per account, `role` admin/member), `members` (everyone, incl. Charlie), `invites` (secret `code`, `expires_at`, single use)
- `events` — calendar; `responsible_member_id` = who does it, `for_member_id` = who it's about; `recurrence` (daily/weekdays/weekly/biweekly/monthly) + `recurrence_until`, expanded in `src/lib/recurrence.ts` / `src/lib/events.ts`; `skip_dates` = occurrences removed or changed on their own (a changed one becomes a separate one-off event); `care` = `dropoff`/`pickup` of a child (Kids tab, `src/lib/care.ts`; stored title stays English, e.g. "Pick-up Charlie", and is translated on display). All-day events include their end date.
- `members` also hold kids' usual `dropoff_time`, `pickup_time`, `care_place`, `care_days` (ISO weekdays)
- `push_subscriptions` — one row per device with reminders on (own rows only)
- `lists` (`kind` grocery/todo) and `list_items` (`category` = aisle id from `src/lib/categories.ts`)
- `purchases` — auto-filled by a trigger when a grocery item is checked off (skipped if the item was logged <10 min ago); `source` list/manual/receipt, `store`, `price`
- `restock_suggestions` — view: average interval between purchases → `next_due_on` (needs ≥2 purchases)
- `recipes` — `ingredients text[]`, `tags text[]`, `favorite`, `kid_friendly`
- `notes` — the family brain
- `gifts` — little gifts between accounts (emoji + note), private to sender/recipient, unwrapped in `GiftInbox`
- `profiles.locale` — app language per account (en/fr/sv)

## Dev

- `npm run dev`, `npm run lint`, `npm run build`
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`)
- Pages under `src/app/(app)` are client components talking to Supabase directly (RLS is the security
  boundary). New tables need RLS + a `family all` policy like the existing ones.
- Claude connector (mcp-handler + MCP SDK v2): `src/app/api/mcp/[token]/route.ts` (personal link) and
  `src/app/api/mcp/route.ts` (Bearer header). Tokens live hashed in `connector_tokens` (created in Profile →
  Connect Claude); `src/lib/mcp/context.ts` resolves token → family + speaker into an AsyncLocalStorage.
  It uses the service-role client (`src/lib/supabase/admin.ts`, bypasses RLS), so every query in
  `src/lib/mcp/tools.ts` must filter by `familyId()`. Server env: `SUPABASE_SERVICE_ROLE_KEY` (or
  `SUPABASE_SECRET_KEY`); legacy single-family `MCP_TOKEN` + `FAMILY_ID` still accepted.
- Schema changes: add a new numbered file in `supabase/migrations/`, never edit an applied one.
- UI text: wrap every string in `t("English text")` from `useFamily()`, then add French and Swedish in
  `src/lib/i18n/fr.ts` / `sv.ts`; `npm run i18n:check` lists what's missing. Format dates with `fmtDate` (`src/lib/dates.ts`).
- No `prompt()`/`confirm()`/`alert()`: deletions act at once and offer Undo (`useToast`), irreversible ones use `ConfirmButton`.
- Colour means a person (member colours); the interface itself is ink-on-paper (`--accent` is ink).
- Optional server env: `ANTHROPIC_API_KEY` (receipt scan + "type it" event entry, `src/lib/ai.ts`),
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (reminders, `src/lib/push.ts`) and `CRON_SECRET`
  (`/api/cron/reminders`, daily at 17:00 UTC via `vercel.json`). Features hide themselves when unset.
