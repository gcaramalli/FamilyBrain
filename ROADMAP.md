# Roadmap

Priorities as of 2026-09-26. Build one batch at a time.

## 0. Hygiene (before anything else)
- [ ] Remove `MCP_TOKEN` + `FAMILY_ID` from Vercel (old single-family connector token; personal links replace it)
- [ ] Verified sending domain in Resend → password reset and email confirmation for everyone
      (required before opening to other families; then turn "Confirm email" back on in Supabase)
- [ ] Production on a `main` branch

## 1. Groceries (daily use)
- [x] Aisles/categories, sorted in store order
- [x] Autocomplete from history (also prevents "Pasta"/"Pâtes" duplicates that skew restock predictions)
- [x] Visible quantity + note, +/- buttons
- [x] Paste several lines at once

## 2. Calendar
- [x] Recurring events (daily preschool drop-off/pick-up, weekly activities) — edits apply to the whole series
- [x] Week view with a "who drops off / picks up" row per day
- [ ] Secret iCal feed per person (`/api/calendar/<token>.ics`) → subscribe from iOS/Google Calendar and get
      native reminders (read-only, periodic refresh)

## 3. Claude & automation
- [ ] Weekly routine (Sunday): week summary + add items that are running out
- [ ] Skip / move a single occurrence of a repeating event
- [x] Show "added by <name>" for items/events created through the connector
- [ ] Test photo → events (school planning, emails) through the connector

## 4. Meals
- [ ] Weekly meal plan → missing ingredients to the shopping list
- [ ] Import a recipe from a URL (schema.org Recipe JSON-LD)
- [x] "What can we cook tonight?" via Claude (`dinner_ideas`) + "Tonight?" card on Today

## 5. If Hembrain becomes a product (Sweden)
- [ ] Swedish UI (+ English), i18n
- [ ] GDPR: privacy policy, self-service data export and account deletion
- [ ] Onboarding for a new family (kids, preschool, usual store)
- [ ] Per-family limits/abuse protection on open sign-up

## Later / maybe
- Child's food diary and BVC milestones, chores, documents vault
- Push notifications (fragile on iOS; the iCal feed covers most of it)
- [x] Receipts: photo → Claude → `log_receipt` (purchases with store/price, checks off the list)
- Kivra: no public API for private users as far as we know — not planned

## Done
- [x] Shared calendar, lists, recipes, notes, admin, profile (PWA)
- [x] Supabase schema with per-family RLS, restock prediction view
- [x] Password sign-in, multi-family sign-up, private invite links, dashboard-created accounts join the inviting family
- [x] Claude connector: 14 tools, personal revocable links (Profile → Connect Claude), knows who is talking
