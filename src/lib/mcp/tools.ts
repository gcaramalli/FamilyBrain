import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { mcpContext, type McpContext } from "./context";
import { categoryById, categoryOrder, guessCategory } from "@/lib/categories";
import { occurrenceDates, RECURRENCES, type Recurrence } from "@/lib/recurrence";
import { stockholmToUtc, utcToStockholm } from "./time";

// Tools exposed to Claude through the family connector. Every query is
// scoped to the caller's family (see ./context.ts) because the service-role
// client bypasses RLS.

export function buildInstructions(ctx: McpContext) {
  const who = ctx.speaker
    ? `The person talking to you is ${ctx.speaker}${ctx.familyName ? ` (family "${ctx.familyName}")` : ""}. "I" / "me" = ${ctx.speaker}.`
    : "Ask who is talking if it matters (e.g. for who is responsible).";
  return `Hembrain: a family's shared calendar, lists, recipes and notes. Times are Europe/Stockholm unless told otherwise.
${who}
Routing:
- Calendar (appointments, who drops off / picks up the kids, trips, birthdays): get_events / add_event / update_event / delete_event.
  Pass times as local time (YYYY-MM-DDTHH:MM). Set "responsible" (who does it) and "for_whom" (who it is about) by first name.
  Check get_events for that day first to avoid duplicates. Only delete when explicitly asked.
- Shopping and to-dos: add_to_list / check_off / get_list. Default list is the first shopping list.
- "We bought X" outside the list: log_purchase (feeds the "running out soon" prediction).
- Recipes: search_recipes / add_recipe. "What should we cook tonight?": dinner_ideas, then suggest 2-3 options
  (prefer favourites and recipes whose ingredients were bought recently) and offer to add missing ingredients.
- Receipt photo: read every line, then log_receipt with store, date and items. Use the family's usual item
  names (see get_list / get_restock_suggestions) rather than raw receipt abbreviations, e.g. "Mellanmjölk 1,5%" → "Milk".
- Family facts (pickup rules, allergies, contacts): get_notes / add_note.
- "Send Jennie a little heart": send_gift (an emoji + optional short note, unwrapped in the app).
Call get_family_context first if you don't know the lists or people. After writing, tell the user exactly what you added and where.`;
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

function familyId() {
  const ctx = mcpContext.getStore();
  if (!ctx) throw new Error("No family context for this request");
  return ctx.familyId;
}

// Who is talking, stored as created_by so the app can show "added by …".
function createdBy() {
  return mcpContext.getStore()?.profileId ?? null;
}

// Category last used for this item in the family, else a keyword guess.
async function categoryFor(title: string) {
  const { data } = await createAdminClient()
    .from("list_items")
    .select("category")
    .eq("family_id", familyId())
    .ilike("title", title.trim())
    .not("category", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.category ?? guessCategory(title);
}

const recurrenceIds = RECURRENCES.map((r) => r.id) as [Recurrence, ...Recurrence[]];

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
  repeats: z.enum(recurrenceIds).optional().describe("Repeat the event: daily, weekdays (Mon-Fri), weekly, biweekly, monthly"),
  repeat_until: z.string().optional().describe("Last date of the series, YYYY-MM-DD"),
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
  repeats?: Recurrence;
  repeat_until?: string;
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
  if (e.repeats !== undefined) row.recurrence = e.repeats;
  if (e.repeat_until !== undefined) row.recurrence_until = e.repeat_until || null;
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
      const fromYmd = from ?? utcToStockholm(new Date().toISOString()).slice(0, 10);
      const start = stockholmToUtc(fromYmd);
      const end = new Date(new Date(start).getTime() + (days ?? 7) * 86400000).toISOString();
      const toYmd = utcToStockholm(new Date(new Date(end).getTime() - 1).toISOString()).slice(0, 10);
      const db = createAdminClient();
      const [{ data: events, error }, { data: members }] = await Promise.all([
        db
          .from("events")
          .select("id, title, starts_at, ends_at, all_day, location, notes, responsible_member_id, for_member_id, recurrence, recurrence_until")
          .eq("family_id", familyId())
          .lt("starts_at", end)
          .or(
            `and(recurrence.is.null,or(starts_at.gte.${start},ends_at.gte.${start})),and(recurrence.not.is.null,or(recurrence_until.is.null,recurrence_until.gte.${fromYmd}))`,
          )
          .order("starts_at"),
        db.from("members").select("id, name").eq("family_id", familyId()),
      ]);
      if (error) throw new Error(error.message);
      const name = (id: string | null) => (members ?? []).find((m) => m.id === id)?.name ?? null;
      const out = [];
      for (const e of events ?? []) {
        const local = utcToStockholm(e.starts_at); // "YYYY-MM-DD HH:MM"
        const [baseDate, time] = local.split(" ");
        const duration = e.ends_at ? new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime() : null;
        // A one-off multi-day event that started before the window and is still running.
        const ongoing = !e.recurrence && baseDate < fromYmd ? [baseDate] : [];
        for (const d of [...ongoing, ...occurrenceDates(baseDate, e.recurrence as Recurrence | null, e.recurrence_until, fromYmd, toYmd)]) {
          const occ = stockholmToUtc(`${d}T${time}`);
          out.push({
            id: e.id,
            title: e.title,
            start: e.all_day ? d : `${d} ${time}`,
            end: duration !== null ? utcToStockholm(new Date(new Date(occ).getTime() + duration).toISOString()) : null,
            all_day: e.all_day,
            repeats: e.recurrence,
            repeat_until: e.recurrence_until,
            location: e.location,
            notes: e.notes,
            responsible: name(e.responsible_member_id),
            for_whom: name(e.for_member_id),
            _sort: occ,
          });
        }
      }
      out.sort((a, b) => a._sort.localeCompare(b._sort));
      return text(out.map((o) => ({ ...o, _sort: undefined })));
    },
  );

  server.registerTool(
    "add_event",
    {
      title: "Add a calendar event",
      description: "Add an event to the family calendar, e.g. 'Jenny picks up Charlie Thursday 16:00'. Use repeats for routines (e.g. daily preschool drop-off: weekdays).",
      inputSchema: z.object({ ...eventFields, title: z.string().min(1), start: z.string() }),
    },
    async (e) => {
      const row = await eventRow(e);
      const { data, error } = await createAdminClient()
        .from("events")
        .insert({ ...row, family_id: familyId(), created_by: createdBy() })
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
      description: "Change an existing event (time, person responsible, place, repetition...). Get the id from get_events. Only pass fields to change. For a repeating event this changes the whole series.",
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
      description: "Remove an event (for a repeating event: the whole series). Only when the user explicitly asks to delete or cancel it.",
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
      let q = createAdminClient().from("list_items").select("title, quantity, notes, done, due_date, category").eq("list_id", l.id).order("created_at");
      if (!include_done) q = q.eq("done", false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const items = (data ?? [])
        .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category))
        .map(({ category, ...i }) => ({ ...i, aisle: l.kind === "grocery" ? categoryById(category).label : undefined }));
      return text({ list: l.name, items });
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
          .insert(
            await Promise.all(
              fresh.map(async (i) => ({
                family_id: familyId(),
                list_id: l.id,
                title: i.title.trim(),
                quantity: i.quantity ?? null,
                category: l.kind === "grocery" ? await categoryFor(i.title) : null,
                created_by: createdBy(),
              })),
            ),
          );
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
            created_by: createdBy(),
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
        .insert({ ...r, tags: (r.tags ?? []).map((t) => t.toLowerCase()), family_id: familyId(), created_by: createdBy() });
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
        .insert({ ...n, tags: (n.tags ?? []).map((t) => t.toLowerCase()), family_id: familyId(), created_by: createdBy() });
      if (error) throw new Error(error.message);
      return text(`Saved note "${n.title}".`);
    },
  );

  server.registerTool(
    "dinner_ideas",
    {
      title: "Dinner ideas",
      description:
        "Recipes to suggest for a meal, ranked by favourites, kid-friendliness and how many ingredients were bought in the last 10 days or are already on the shopping list.",
      inputSchema: z.object({
        max_minutes: z.number().int().optional().describe("Only recipes that take at most this long"),
        kid_friendly_only: z.boolean().optional(),
      }),
    },
    async ({ max_minutes, kid_friendly_only }) => {
      const db = createAdminClient();
      const since = new Date(Date.now() - 10 * 86400000).toISOString();
      const [{ data: recipes, error }, { data: bought }, { data: listed }] = await Promise.all([
        db.from("recipes").select("title, description, ingredients, tags, prep_minutes, favorite, kid_friendly").eq("family_id", familyId()),
        db.from("purchases").select("item_key").eq("family_id", familyId()).gte("purchased_at", since),
        db.from("list_items").select("title").eq("family_id", familyId()).eq("done", false),
      ]);
      if (error) throw new Error(error.message);
      const have = new Set([...(bought ?? []).map((b) => b.item_key), ...(listed ?? []).map((l) => l.title.trim().toLowerCase())]);
      const matches = (ingredient: string) => [...have].some((h) => h.length > 2 && ingredient.toLowerCase().includes(h));
      const ranked = (recipes ?? [])
        .filter((r) => (!max_minutes || !r.prep_minutes || r.prep_minutes <= max_minutes) && (!kid_friendly_only || r.kid_friendly))
        .map((r) => {
          const inHand = r.ingredients.filter(matches);
          return {
            ...r,
            ingredients_in_hand: inHand,
            ingredients_missing: r.ingredients.filter((i: string) => !matches(i)),
            score: (r.favorite ? 3 : 0) + (r.kid_friendly ? 1 : 0) + inHand.length,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      if (!ranked.length) return text("No recipes saved yet. Suggest ideas from general knowledge and offer to save the ones they like with add_recipe.");
      return text(ranked);
    },
  );

  server.registerTool(
    "log_receipt",
    {
      title: "Log a receipt",
      description:
        "Record everything bought on a receipt (read from a photo). Logs each line as a purchase (with store and price) and checks off matching items on the shopping lists.",
      inputSchema: z.object({
        store: z.string().optional().describe("e.g. ICA Maxi Lindhagen"),
        date: z.string().optional().describe("Purchase date YYYY-MM-DD (Stockholm); default today"),
        items: z
          .array(
            z.object({
              name: z.string().min(1).describe("Normalized item name the family uses, e.g. 'Milk' (not 'MELLANMJ 1,5%')"),
              quantity: z.string().optional(),
              price: z.number().optional().describe("Line total in SEK"),
            }),
          )
          .min(1),
      }),
    },
    async ({ store, date, items }) => {
      const db = createAdminClient();
      const purchasedAt = date ? stockholmToUtc(`${date}T12:00`) : new Date().toISOString();
      // Log purchases first: the check-off trigger then skips its own duplicate.
      const { error } = await db.from("purchases").insert(
        items.map((i) => ({
          family_id: familyId(),
          item_name: i.name.trim(),
          quantity: i.quantity ?? null,
          price: i.price ?? null,
          store: store ?? null,
          source: "receipt",
          purchased_at: purchasedAt,
          created_by: createdBy(),
        })),
      );
      if (error) throw new Error(error.message);

      const { data: open } = await db
        .from("list_items")
        .select("id, title, lists!inner(kind)")
        .eq("family_id", familyId())
        .eq("done", false)
        .eq("lists.kind", "grocery");
      const names = items.map((i) => i.name.trim().toLowerCase());
      const hits = (open ?? []).filter((o) => {
        const t = o.title.trim().toLowerCase();
        return names.some((n) => n === t || (t.length > 2 && n.includes(t)) || (n.length > 2 && t.includes(n)));
      });
      if (hits.length) {
        await db.from("list_items").update({ done: true, done_at: new Date().toISOString() }).in("id", hits.map((h) => h.id));
      }
      const total = items.reduce((s, i) => s + (i.price ?? 0), 0);
      return text({
        logged: items.length,
        store: store ?? null,
        total_sek: total ? Math.round(total * 100) / 100 : null,
        checked_off_from_list: hits.map((h) => h.title),
      });
    },
  );

  server.registerTool(
    "send_gift",
    {
      title: "Send a little gift",
      description: "Send a family member a small gift (emoji + optional note) that they unwrap next time they open the app.",
      inputSchema: z.object({
        to: z.string().describe("First name of the family member with an account, e.g. 'Jennie'"),
        emoji: z.string().max(16).optional().describe("Default ❤️"),
        message: z.string().max(140).optional(),
      }),
    },
    async ({ to, emoji, message }) => {
      const from = createdBy();
      if (!from) throw new Error("Gifts need a personal connector link (Profile → Connect Claude) so we know who sends it.");
      const db = createAdminClient();
      const { data: people } = await db.from("profiles").select("id, display_name").eq("family_id", familyId());
      const n = to.trim().toLowerCase();
      const target =
        (people ?? []).find((p) => p.display_name.toLowerCase() === n) ?? (people ?? []).find((p) => p.display_name.toLowerCase().startsWith(n));
      if (!target) throw new Error(`No account named "${to}". People with an account: ${(people ?? []).map((p) => p.display_name).join(", ")}`);
      if (target.id === from) throw new Error("You can't send a gift to yourself.");
      const { error } = await db
        .from("gifts")
        .insert({ family_id: familyId(), from_profile: from, to_profile: target.id, emoji: emoji || "❤️", message: message?.trim() || null });
      if (error) throw new Error(error.message);
      return text(`Sent ${emoji || "❤️"} to ${target.display_name}. They'll unwrap it next time they open Hembrain.`);
    },
  );
}
