# Roadmap & ideas

Build one feature at a time. Rough priority order — reorder freely.

## Next up
- [ ] **Deploy**: Supabase project + Vercel (see README)
- [ ] **Claude integration, the safe way**: the Supabase connector works today but gives Claude full
      admin access to the database (and to other projects on the same account). Better: a small MCP
      endpoint in this app (`/api/mcp`) with a family token and a few tools — `add_event`,
      `add_to_list`, `log_purchase`, `get_notes` — then add it as a custom connector in the Claude app.
- [ ] **Recurring events**: daily förskola drop-off/pickup, weekly swimming (RRULE column).
- [ ] **Week view** with a "who picks up Charlie" row per day.
- [ ] **Push notifications** (PWA web push works on iOS 16.4+ once installed on the home screen):
      "You're picking up Charlie in 30 min", "Milk probably running out".

## Groceries & restock
- [ ] Categories / store aisle ordering (dairy, fruit, hygiene…)
- [ ] Autocomplete from purchase history
- [ ] Smarter restock: an agent reviews history weekly and fills the "probably needed" list
- [ ] **Receipts**: upload a photo/PDF → Claude extracts line items → `purchases` (`source = 'receipt'`)
- [ ] **Kivra**: as far as we know Kivra has no public API for private users (its API is for companies
      *sending* documents), so no direct sync. Realistic paths: share the receipt PDF from the Kivra app
      to this app (upload), or forward receipts by email to an inbound address that parses them.
      Also check whether your store's own app (ICA, Coop, Willys…) exports purchase history — often
      easier than Kivra.

## Recipes & meals
- [ ] Weekly meal plan (drag recipes onto days) → one tap to add missing ingredients
- [ ] Import a recipe from a URL (parse schema.org Recipe JSON-LD)
- [ ] "What can we cook with what we have?" (Claude, using recipes + recent purchases)
- [ ] Charlie's food diary: new foods introduced, reactions, likes/dislikes

## What typical family apps offer (for inspiration)
- Shared calendar with colour per person, recurring events, reminders (Cozi, FamilyWall, TimeTree)
- Shared shopping & to-do lists with live sync (OurGroceries, AnyList, Bring!)
- Meal planner linked to recipes and shopping list (Mealime, Paprika, AnyList)
- Chores & routines, with rewards for kids later (OurHome)
- Family contacts & important info: doctor, BVC, förskola, babysitters, insurance
- Documents vault: passports, vaccination records, warranties
- Budget / shared expenses (Splitwise-style) — maybe link with receipts
- Baby tracker: sleep, feeding, growth, vaccinations (BVC schedule)
- Birthdays & gift ideas list, holiday packing lists
- Photo journal / milestones ("first steps")
- Location sharing — better left to Find My / Google Maps
