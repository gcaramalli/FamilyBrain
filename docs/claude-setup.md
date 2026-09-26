# Using Family Brain from the Claude app

Talk to Claude ("add nappies and milk", "we bought toothpaste", "what can we cook tonight?") and it
writes into the app: calendar, lists, recipes and notes.

## 1. Server settings (once, in Vercel → Project → Settings → Environment Variables)

| Variable | Where to find it |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` / secret key. **Server-only**: never prefix with `NEXT_PUBLIC_`. |
| `FAMILY_ID` | Supabase SQL editor: `select id, name from families;` |
| `MCP_TOKEN` | A long random string: `openssl rand -hex 32` (at least 24 characters, otherwise the connector stays disabled) |

Redeploy after adding them.

Connector URL: `https://caramalli-familly-brain.vercel.app/api/mcp` (no secret in it).
The secret goes in a request header: `Authorization` = `Bearer <MCP_TOKEN>`.

⚠️ `MCP_TOKEN` works like a password: anyone who has it can read and write your lists, recipes and notes
(not the calendar, not accounts). Never paste it in chats or screenshots. If it leaks, generate a new one,
update `MCP_TOKEN` in Vercel, redeploy, and update the header in each Claude account.

(Legacy: `/api/mcp/<MCP_TOKEN>` still works but puts the secret in the URL — avoid.)

## 2. Add the connector (each of you, in your own Claude account)

Claude app / claude.ai → Settings → Connectors → **Add custom connector** → name "Family Brain",
URL above, Authentication **None**, then **Add header**: name `Authorization`, value `Bearer <MCP_TOKEN>`.

## 3. Create a "Famille" project in Claude

Claude → Projects → New project → "Famille" → paste this into the project instructions:

```
You are our family assistant (Guillaume, Jenny and our son Charlie, in Sweden — times are
Europe/Stockholm). Route every request:

- Calendar (appointments, who drops off / picks up Charlie, trips, birthdays):
  Family Brain → get_events / add_event / update_event (delete_event only if asked).
  Set responsible (who does it) and for_whom (who it's about). Use the förskola address
  from Family Brain notes when relevant.
- Shopping and to-dos: Family Brain → add_to_list (default = shopping list), check_off, get_list.
- "We bought X" without it being on the list: Family Brain → log_purchase.
- Recipes and meal ideas: Family Brain → search_recipes / add_recipe. Prefer favourites and
  kid-friendly recipes; to cook one, add its missing ingredients with add_to_list.
- Facts worth remembering (addresses, rules, allergies, contacts): Family Brain → add_note / get_notes.

For photos (school planning, emails, receipts): extract everything, then create all events/items.
One message can contain several requests: handle each one.
Always finish with a short summary of exactly what you added and where. If a date or person is
ambiguous, ask before writing.
```

Start family conversations inside this project so the routing rules apply.

## Claude Code

Claude Code can use the same connector:

```bash
claude mcp add --transport http family-brain https://caramalli-familly-brain.vercel.app/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
```
