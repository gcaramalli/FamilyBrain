# Caramalli Family Brain 🏡

Shared family app for Guillaume, Jenny and Charlie: **calendar**, **shared lists** (groceries, to-dos),
**recipes**, and a **family brain** (notes: pickup rules, allergies, contacts…). Works on both phones as
an installable web app (PWA).

Stack: Next.js 16 (App Router) · Supabase (Postgres, Auth, Realtime) · Tailwind CSS 4 · Vercel.

## What's in v1

| Tab | What it does |
|---|---|
| **Today** | Today's and tomorrow's events, number of items to buy, things running out |
| **Calendar** | 14-day agenda, add/edit events, *who's responsible* (e.g. Jenny) and *for whom* (e.g. Charlie) |
| **Lists** | Multiple shared lists, live sync between phones, "2 milk" parses the quantity |
| **🔮 Probably needed soon** | On shopping lists: items you buy regularly that are due within 7 days (average gap between purchases — no AI yet) |
| **Recipes** | Search, tags, favourites, kid-friendly flag, "🎲 Idea" random pick, "Add all to groceries" |
| **Brain** | Free-form family notes, pinned and tagged |
| **Profile** (avatar, top right) | Name, emoji, calendar colour, sign out, install instructions |
| **Admin** (⚙️, admins only) | Family name, members (add Charlie), invite Jenny, roles, lists, purchase log |

Every checked-off shopping item is logged in `purchases`. You can also log a purchase manually in
Admin ("I just bought toothpaste"). After an item has been bought twice, the app starts predicting
when it's due again.

## Setup (≈15 minutes)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (region: Stockholm `eu-north-1`).
2. **SQL Editor** → paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   (Or with the CLI: `supabase link` then `supabase db push`.)
3. **Authentication → Email templates → Magic Link**: make sure the template shows the code, e.g.
   `<p>Your code: <b>{{ .Token }}</b></p>`. The app signs in with a 6-digit code, because on iPhone a
   magic link opens Safari instead of the home-screen app.
4. **Authentication → URL configuration**: set *Site URL* to your Vercel URL once you have it.
5. **Project Settings → API**: copy the Project URL and the anon/publishable key.

### 2. Run locally (optional)
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

### 3. Vercel
1. Import this GitHub repo on [vercel.com/new](https://vercel.com/new).
2. The public Supabase URL and key default to the family project (`src/lib/supabase/config.ts`); env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` override them.
3. Deploy, then put the URL in Supabase *Site URL* (step 1.4).

### 4. Family onboarding
1. **Guillaume signs in first** → a family is created, he's admin, with a *Groceries* and a *To-do* list.
2. Admin → **Invite** Jenny's email. When she signs in with that email she joins the family automatically.
3. Admin → **+ Person** → Charlie 👶 (no account needed).
4. Both: open the URL on the phone → *Add to Home Screen*.
5. Once both of you are in: Supabase → Authentication → Sign In / Providers → turn **off** "Allow new
   users to sign up". Anyone else signing up would only get an empty family of their own (RLS isolates
   families), but there's no reason to leave the door open.

## Using it from Claude

The app exposes a **Claude connector** (MCP) at `/api/mcp` (bearer token header) with 10 tools: lists, check-off,
purchases, restock suggestions, recipes, notes. Calendar requests go to your shared Google Calendar via
the Google Calendar connector. Setup (env vars, adding the connector, the "Famille" project prompt):
[`docs/claude-setup.md`](docs/claude-setup.md).

## Project layout

```
supabase/migrations/   database schema, RLS policies, triggers, restock view
src/proxy.ts           session refresh + redirect to /login (Next 16 "proxy", formerly middleware)
src/app/login          email + code sign-in
src/app/(app)/         the signed-in tabs: page.tsx (Today), calendar, lists, recipes, brain, profile, admin
src/components/        app shell, bottom sheet, forms, family context
src/app/api/mcp/       Claude connector endpoint
src/lib/mcp/tools.ts   the connector's tools
src/lib/               Supabase clients, types, date helpers
```

See [`ROADMAP.md`](ROADMAP.md) for what comes next.
