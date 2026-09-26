import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockholmToUtc, utcToStockholm } from "./time";

// Tools exposed to Claude through the family connector. Every query is
// scoped to FAMILY_ID because the service-role client bypasses RLS.

export const instructions = `Family Brain for Guillaume, Jenny and their son Charlie (Sweden, Europe/Stockholm time).
Routing:
- Calendar (appointments, who drops off / picks up Charlie, trips, birthdays): get_events / add_event / update_event / delete_event.
  Pass times as local Stockholm time (YYYY-MM-DDTHH:MM). Set "responsible" (who does it) and "for_whom" (who it is about) by first name.
  Check get_events for that day first to avoid duplicates. Only delete when explicitly asked.
- Shopping and to-dos: add_to_list / check_off / get_list. Default list is the first shopping list.
- "We bought X" outside the list: log_purchase (feeds the "running out soon" prediction).
- Recipes: search_recipes / add_recipe. Family facts (pickup rules, allergies, contacts): get_notes / add_note.
Call get_family_context first if you don't know the lists or people. After writing, tell the user exactly what you added and where.`;

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

function familyId() {
  const id = process.env.FAMILY_ID;
  if (!id) throw new Error("FAMILY_ID is not set");
  return id;
}

async function resolveList(name?: string) {
  const db = createAdminClient();
  const { data: lists, error } = await db.from("lists").select("id, name, kind").eq("family_id", familyId()).order("position");
  if (error) throw new Error(error.message);
  if (!lists?.length) throw new Error("This family has no lists yet.");
  if (name) {
    const n = name.trim().toLowerCase();
    const match = lists.find((l) => l.name.toLowerCase() === n) ?? lists.find((l) => l.name.toLowerCase().includes(n));
    if (!match) throw new Error(`No list called "${name}". Lists: ${lists.map((l) => l.name).join(", ")}`);
    return match;
  }
  return lists.find((l) => l.kind === "grocery") ?? lists[0];
}

async function memberIdByName(name?: string | null) {
  if (!name) return null;
  const { data } = await createAdminClient().from("members").select("id, name").eq("family_id", familyId());
  const n = name.trim().toLowerCase();
  const m = (data ?? []).find((x) => x.name.toLowerCase() === n) ?? (data ?? []).find((x) => x.name.toLowerCase().startsWith(n));
  if (!m) throw new Error(`Unknown family member "${name}". Members: ${(data ?? []).map((x) => x.name).join(", ")}`);
  return m.id;
}

const eventFields = {
  title: z.string().min(1).optional(),
  start: z.string().optional().describe("Local Stockholm time: YYYY-MM-DDTHH:MM, or YYYY-MM-DD for all-day"),
  end: z.string().optional().describe("Local Stockholm time, optional"),
  all_day: z.boolean().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  responsible: z.string().optional().describe("First name of who does it, e.g. 'Jenny'"),
  for_whom: z.string().optional().describe("First name of who it is about, e.g. 'Charlie'"),
};

async function eventRow(e: {
  title?: string;
  start?: string;
  end?: string;
  all_day?: boolean;
  location?: string;
  notes?: string;
  responsible?: string;
  for_whom?: string;
}) {
  const row: Record<string, unknown> = {};
  if (e.title !== undefined) row.title = e.title;
  if (e.all_day !== undefined) row.all_day = e.all_day;
  if (e.start !== undefined) {
    row.starts_at = stockholmToUtc(e.start);
    if (e.all_day === undefined && /^\d{4}-\d{2}-\d{2}$/.test(e.start.trim())) row.all_day = true;
  }
  if (e.end !== undefined) row.ends_at = e.end ? stockholmToUtc(e.end) : null;
  if (e.location !== undefined) row.location = e.location || null;
  if (e.notes !== undefined) row.notes = e.notes || null;
  if (e.responsible !== undefined) row.responsible_member_id = await memberIdByName(e.responsible);
  if (e.for_whom !== undefined) row.for_member_id = await memberIdByName(e.for_whom);
  return row;
}

const itemSchema = z.object({
  title: z.string().min(1).describe("Item name, e.g. 'Milk'"),
  quantity: z.string().optional().describe("e.g. '2', '1 kg'"),
});

export function registerTools(server: McpServer) {
  server.registerTool(
    "get_family_context",
    {
      title: "Get family context",
      description: "People in the family, available lists, and pinned notes. Call this first when unsure.",
      inputSchema: z.object({}),
    },
    async () => {
      const db = createAdminClient();
      const fid = familyId();
      const [members, lists, notes] = await Promise.all([
        db.from("members").select("name, birthdate, notes").eq("family_id", fid).order("created_at"),
        db.from("lists").select("name, kind").eq("family_id", fid).order("position"),
        db.from("notes").select("title, body").eq("family_id", fid).eq("pinned", true),
      ]);
      return text({ members: members.data, lists: lists.data, pinned_notes: notes.data });
    },
  );

  server.registerTool(
    "get_events",
    {
      title: "Get calendar events",
      description: "Family calendar events in a date range (Stockholm time). Returns ids for update_event / delete_event.",
      inputSchema: z.object({
        from: z.string().optional().describe("YYYY-MM-DD, default today"),
        days: z.number().int().min(1).max(92).optional().describe("Default 7"),
      }),
    },
    async ({ from, days }) => {
      const start = stockholmToUtc(from ?? utcToStockholm(new Date().toISOString()).slice(0, 10));
      const end = new Date(new Date(start).getTime() + (days ?? 7) * 86400000).toISOString();
      const db = createAdminClient();
      const [{ data: events, error }, { data: members }] = await Promise.all([
        db
          .from("events")
          .select("id, title, starts_at, ends_at, all_day, location, notes, responsible_member_id, for_member_id")
          .eq("family_id", familyId())
          .gte("starts_at", start)
          .lt("starts_at", end)
          .order("starts_at"),
        db.from("members").select("id, name").eq("family_id", familyId()),
      ]);
      if (error) throw new Error(error.message);
      const name = (id: string | null) => (members ?? []).find((m) => m.id === id)?.name ?? null;
      return text(
        (events ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          start: e.all_day ? utcToStockholm(e.starts_at).slice(0, 10) : utcToStockholm(e.starts_at),
          end: e.ends_at ? utcToStockholm(e.ends_at) : null,
          all_day: e.all_day,
          location: e.location,
          notes: e.notes,
          responsible: name(e.responsible_member_id),
          for_whom: name(e.for_member_id),
        })),
      );
    },
  );

  server.registerTool(
    "add_event",
    {
      title: "Add a calendar event",
      description: "Add an event to the family calendar, e.g. 'Jenny picks up Charlie Thursday 16:00'.",
      inputSchema: z.object({ ...eventFields, title: z.string().min(1), start: z.string() }),
    },
    async (e) => {
      const row = await eventRow(e);
      const { data, error } = await createAdminClient()
        .from("events")
        .insert({ ...row, family_id: familyId() })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return text({ added: e.title, start: e.start, responsible: e.responsible ?? null, for_whom: e.for_whom ?? null, id: data.id });
    },
  );

  server.registerTool(
    "update_event",
    {
      title: "Update a calendar event",
      description: "Change an existing event (time, person responsible, place...). Get the id from get_events. Only pass fields to change.",
      inputSchema: z.object({ id: z.string().uuid(), ...eventFields }),
    },
    async ({ id, ...e }) => {
      const row = await eventRow(e);
      if (!Object.keys(row).length) return text("Nothing to change.");
      const { data, error } = await createAdminClient()
        .from("events")
        .update(row)
        .eq("id", id)
        .eq("family_id", familyId())
        .select("title")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No event with that id.");
      return text({ updated: data.title, changes: Object.keys(e) });
    },
  );

  server.registerTool(
    "delete_event",
    {
      title: "Delete a calendar event",
      description: "Remove an event. Only when the user explicitly asks to delete or cancel it.",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => {
      const { data, error } = await createAdminClient()
        .from("events")
        .delete()
        .eq("id", id)
        .eq("family_id", familyId())
        .select("title")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No event with that id.");
      return text({ deleted: data.title });
    },
  );

  server.registerTool(
    "get_list",
    {
      title: "Get a list",
      description: "Open items of a shopping or to-do list.",
      inputSchema: z.object({
        list: z.string().optional().describe("List name; defaults to the main shopping list"),
        include_done: z.boolean().optional(),
      }),
    },
    async ({ list, include_done }) => {
      const l = await resolveList(list);
      let q = createAdminClient().from("list_items").select("title, quantity, done, due_date").eq("list_id", l.id).order("created_at");
      if (!include_done) q = q.eq("done", false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return text({ list: l.name, items: data });
    },
  );

  server.registerTool(
    "add_to_list",
    {
      title: "Add to list",
      description: "Add one or more items to a shopping or to-do list. Skips items already open on the list.",
      inputSchema: z.object({
        items: z.array(itemSchema).min(1),
        list: z.string().optional().describe("List name; defaults to the main shopping list"),
      }),
    },
    async ({ items, list }) => {
      const db = createAdminClient();
      const l = await resolveList(list);
      const { data: open } = await db.from("list_items").select("title").eq("list_id", l.id).eq("done", false);
      const existing = new Set((open ?? []).map((i) => i.title.trim().toLowerCase()));
      const fresh = items.filter((i) => !existing.has(i.title.trim().toLowerCase()));
      if (fresh.length) {
        const { error } = await db
          .from("list_items")
          .insert(fresh.map((i) => ({ family_id: familyId(), list_id: l.id, title: i.title.trim(), quantity: i.quantity ?? null })));
        if (error) throw new Error(error.message);
      }
      const skipped = items.filter((i) => !fresh.includes(i)).map((i) => i.title);
      return text({ list: l.name, added: fresh.map((i) => i.title), already_on_list: skipped });
    },
  );

  server.registerTool(
    "check_off",
    {
      title: "Check off items",
      description: "Mark items as done/bought. On a shopping list this also records the purchase.",
      inputSchema: z.object({
        titles: z.array(z.string().min(1)).min(1),
        list: z.string().optional(),
      }),
    },
    async ({ titles, list }) => {
      const db = createAdminClient();
      const l = await resolveList(list);
      const { data: open } = await db.from("list_items").select("id, title").eq("list_id", l.id).eq("done", false);
      const wanted = titles.map((t) => t.trim().toLowerCase());
      const hits = (open ?? []).filter((i) => wanted.includes(i.title.trim().toLowerCase()));
      if (hits.length) {
        const { error } = await db
          .from("list_items")
          .update({ done: true, done_at: new Date().toISOString() })
          .in("id", hits.map((h) => h.id));
        if (error) throw new Error(error.message);
      }
      const found = new Set(hits.map((h) => h.title.trim().toLowerCase()));
      return text({ list: l.name, checked: hits.map((h) => h.title), not_found: titles.filter((t) => !found.has(t.trim().toLowerCase())) });
    },
  );

  server.registerTool(
    "log_purchase",
    {
      title: "Log a purchase",
      description: "Record things bought outside the list (e.g. 'I bought toothpaste'), so the app learns how often they are needed.",
      inputSchema: z.object({
        items: z.array(itemSchema).min(1),
        purchased_at: z.string().optional().describe("ISO date/time; defaults to now"),
      }),
    },
    async ({ items, purchased_at }) => {
      const { error } = await createAdminClient()
        .from("purchases")
        .insert(
          items.map((i) => ({
            family_id: familyId(),
            item_name: i.title.trim(),
            quantity: i.quantity ?? null,
            source: "manual",
            ...(purchased_at ? { purchased_at } : {}),
          })),
        );
      if (error) throw new Error(error.message);
      return text({ logged: items.map((i) => i.title) });
    },
  );

  server.registerTool(
    "get_restock_suggestions",
    {
      title: "Running out soon",
      description: "Items the family buys regularly that are probably due soon, based on purchase history.",
      inputSchema: z.object({ within_days: z.number().int().min(0).max(60).optional().describe("Default 7") }),
    },
    async ({ within_days }) => {
      const until = new Date(Date.now() + (within_days ?? 7) * 86400000).toISOString().slice(0, 10);
      const { data, error } = await createAdminClient()
        .from("restock_suggestions")
        .select("item_name, last_bought_at, avg_interval_days, next_due_on")
        .eq("family_id", familyId())
        .lte("next_due_on", until)
        .order("next_due_on");
      if (error) throw new Error(error.message);
      return text(data);
    },
  );

  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description: "Find family recipes by name, ingredient or tag. Empty query lists them all.",
      inputSchema: z.object({
        query: z.string().optional(),
        favorites_only: z.boolean().optional(),
        kid_friendly_only: z.boolean().optional(),
      }),
    },
    async ({ query, favorites_only, kid_friendly_only }) => {
      let q = createAdminClient()
        .from("recipes")
        .select("title, description, ingredients, steps, tags, prep_minutes, servings, favorite, kid_friendly, source_url")
        .eq("family_id", familyId())
        .order("title");
      if (favorites_only) q = q.eq("favorite", true);
      if (kid_friendly_only) q = q.eq("kid_friendly", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const needle = query?.trim().toLowerCase();
      const hits = needle
        ? (data ?? []).filter((r) => [r.title, r.description ?? "", ...r.ingredients, ...r.tags].join(" ").toLowerCase().includes(needle))
        : data;
      return text(hits);
    },
  );

  server.registerTool(
    "add_recipe",
    {
      title: "Add a recipe",
      description: "Save a recipe to the family cookbook.",
      inputSchema: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        ingredients: z.array(z.string()).describe("One ingredient per entry, e.g. '400 g pasta'"),
        steps: z.string().optional(),
        tags: z.array(z.string()).optional(),
        prep_minutes: z.number().int().optional(),
        servings: z.number().int().optional(),
        source_url: z.string().optional(),
        kid_friendly: z.boolean().optional(),
      }),
    },
    async (r) => {
      const { error } = await createAdminClient()
        .from("recipes")
        .insert({ ...r, tags: (r.tags ?? []).map((t) => t.toLowerCase()), family_id: familyId() });
      if (error) throw new Error(error.message);
      return text(`Saved recipe "${r.title}".`);
    },
  );

  server.registerTool(
    "get_notes",
    {
      title: "Family notes",
      description: "Search the family brain: pickup rules, addresses, allergies, contacts, sizes, codes.",
      inputSchema: z.object({ query: z.string().optional() }),
    },
    async ({ query }) => {
      const { data, error } = await createAdminClient()
        .from("notes")
        .select("title, body, tags, pinned, updated_at")
        .eq("family_id", familyId())
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      const needle = query?.trim().toLowerCase();
      return text(needle ? (data ?? []).filter((n) => `${n.title} ${n.body} ${n.tags.join(" ")}`.toLowerCase().includes(needle)) : data);
    },
  );

  server.registerTool(
    "add_note",
    {
      title: "Add a family note",
      description: "Save a fact worth remembering (e.g. kindergarten address, a doctor's number).",
      inputSchema: z.object({
        title: z.string().min(1),
        body: z.string(),
        tags: z.array(z.string()).optional(),
        pinned: z.boolean().optional(),
      }),
    },
    async (n) => {
      const { error } = await createAdminClient()
        .from("notes")
        .insert({ ...n, tags: (n.tags ?? []).map((t) => t.toLowerCase()), family_id: familyId() });
      if (error) throw new Error(error.message);
      return text(`Saved note "${n.title}".`);
    },
  );
}
