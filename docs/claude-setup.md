# Using Hembrain from the Claude app

Talk to Claude ("add nappies and milk", "Jennie picks up Charlie Thursday at 16:00", "what can we cook
tonight?") and it writes into the app: calendar, lists, recipes and notes.

## How it works

The app exposes an MCP connector: 17 tools (get_events, add_event, add_to_list, check_off, log_purchase,
log_receipt, dinner_ideas, send_gift, search_recipes, get_notes…). Send a photo of a receipt and Claude logs it. Claude calls them when you ask for something; it never browses the site and
does nothing on its own unless you set up a scheduled routine.

Each person has their **own link**, created in the app: it tells the connector who is talking and which
family to use. Nothing to configure in Vercel.

## Set up (each person, once)

1. In the app: **Profile → Connect Claude → + Create a Claude link** → copy the link (shown only once).
2. In Claude (app or claude.ai): **Settings → Connectors → Add custom connector**
   - Name: `Hembrain`
   - URL: paste the link
   - Authentication: **None**, no headers
3. Test in a new conversation: "What's on the calendar this week?"

⚠️ The link works like a password (it acts as you, in your family). Paste it only into Claude — never in a
chat, note or screenshot. If it leaks: Profile → Connect Claude → **Revoke**, then create a new one.

Optional: a Claude project with extra instructions ("prefer kid-friendly recipes", "our preschool is …").
The connector already tells Claude who you are and how to route requests.

## Claude Code

```bash
claude mcp add --transport http hembrain https://hembrain.vercel.app/api/mcp --header "Authorization: Bearer <token>"
```
(`<token>` = the part of your link after `/api/mcp/`.)

## Legacy

`MCP_TOKEN` + `FAMILY_ID` env vars in Vercel still work for one family (no speaker). Prefer personal links.
