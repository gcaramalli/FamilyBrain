# Hembrain 🏡

Shared family app (multi-family): **calendar**, **shared lists** (groceries, to-dos),
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

### 4. Family onboarding (multi-family)
Supabase → Authentication → Sign In / Providers: **Allow new users to sign up** = on, and under Email,
**Confirm email** = off (the sandbox mailer can't reach other people; turn it back on once a real sending
domain is set up).

1. Open `/signup` → **Create your family**: family name, first name, email, password. You become admin, with a
   *Groceries* and a *To-do* list.
2. Admin → **Invite**: enter their email and role → the phone's share sheet opens with a private link
   (`/signup?invite=…`, single use, 14 days). Send it by SMS/WhatsApp.
   Or create their account yourself in Supabase → Authentication → Users → **Add user** with the invited
   email: accounts created there carry no sign-up data, so they join the family that invited that email.
   Pick "For <member>" on the invite to link the account to an existing member card.
3. They open the link, enter first name, email and password, and land in your family. If an admin already
   created a member with the same first name, that member is linked to the new account.
4. Admin → **+ Person** for people without an account (kids).
5. Everyone: open the URL on the phone → *Add to Home Screen*.

Joining requires the invite code, not just a matching email: with email confirmation off, an email address
proves nothing. Each family only ever sees its own data (RLS on `family_id`).

## Using it from Claude

The app exposes a **Claude connector** (MCP) with 16 tools; each person creates a personal link in Profile → Connect Claude. Tools cover: calendar, lists,
check-off, purchases, restock suggestions, recipes, notes. Setup (env vars, adding the connector, the "Famille" project prompt):
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
