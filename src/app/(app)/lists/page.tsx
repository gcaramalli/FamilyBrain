"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { MemberBadge, MemberSelect } from "@/components/member-select";
import { Sheet } from "@/components/sheet";
import { CATEGORIES, categoryById, categoryOrder, guessCategory } from "@/lib/categories";
import { daysUntil } from "@/lib/dates";
import type { List, ListItem, RestockSuggestion } from "@/lib/types";

type Known = { title: string; category: string | null; count: number };

// "2 milk" → { quantity: "2", title: "milk" }
function parseLine(line: string) {
  const text = line.trim().replace(/^[-*•]\s*/, "");
  const m = text.match(/^(\d+(?:[.,]\d+)?\s*(?:x|st|kg|g|l|dl|cl|pcs|pack|förp)?)\s+(.+)$/i);
  return m ? { title: m[2].trim(), quantity: m[1].trim() } : { title: text, quantity: null };
}

export default function ListsPage() {
  const { supabase } = useFamily();
  const [lists, setLists] = useState<List[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);
  const [history, setHistory] = useState<Map<string, Known>>(new Map());
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null);

  const active = lists.find((l) => l.id === activeId) ?? null;
  const isGrocery = active?.kind === "grocery";

  useEffect(() => {
    supabase
      .from("lists")
      .select("*")
      .order("position")
      .then(({ data }) => {
        const ls = (data ?? []) as List[];
        setLists(ls);
        setActiveId((cur) => cur ?? ls[0]?.id ?? null);
      });
  }, [supabase]);

  const loadItems = useCallback(async () => {
    if (!activeId) return;
    const { data } = await supabase.from("list_items").select("*").eq("list_id", activeId).order("created_at");
    setItems((data ?? []) as ListItem[]);
  }, [supabase, activeId]);

  const loadRestock = useCallback(async () => {
    const { data } = await supabase.from("restock_suggestions").select("*").order("next_due_on");
    setRestock((data ?? []) as RestockSuggestion[]);
  }, [supabase]);

  // Everything the family has put on a list or bought: autocomplete + the
  // category last used for each item.
  const loadHistory = useCallback(async () => {
    const [{ data: past }, { data: bought }] = await Promise.all([
      supabase.from("list_items").select("title, category, created_at").order("created_at", { ascending: false }).limit(600),
      supabase.from("purchases").select("item_name").order("purchased_at", { ascending: false }).limit(400),
    ]);
    const map = new Map<string, Known>();
    for (const r of past ?? []) {
      const k = r.title.trim().toLowerCase();
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { title: r.title.trim(), category: r.category, count: 1 });
    }
    for (const r of bought ?? []) {
      const k = r.item_name.trim().toLowerCase();
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { title: r.item_name.trim(), category: null, count: 1 });
    }
    setHistory(map);
  }, [supabase]);

  useEffect(() => {
    loadItems();
    loadRestock();
    loadHistory();
    const channel = supabase
      .channel("list_items")
      .on("postgres_changes", { event: "*", schema: "public", table: "list_items" }, () => {
        loadItems();
        loadRestock();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadItems, loadRestock, loadHistory]);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const onList = useMemo(() => new Set(open.map((i) => i.title.trim().toLowerCase())), [open]);

  // Items the family usually buys that are due within a week and not already on the list.
  const suggestions = useMemo(
    () => restock.filter((r) => daysUntil(r.next_due_on) <= 7 && !onList.has(r.item_key)),
    [restock, onList],
  );

  const autocomplete = useMemo(() => {
    const q = parseLine(title).title.toLowerCase();
    if (!q) return [];
    const all = [...history.values()].filter((h) => !onList.has(h.title.toLowerCase()) && h.title.toLowerCase() !== q);
    const starts = all.filter((h) => h.title.toLowerCase().startsWith(q));
    const contains = all.filter((h) => !h.title.toLowerCase().startsWith(q) && h.title.toLowerCase().includes(q));
    return [...starts, ...contains].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [title, history, onList]);

  const categoryFor = useCallback(
    (t: string) => {
      if (!isGrocery) return null;
      return history.get(t.trim().toLowerCase())?.category ?? guessCategory(t);
    },
    [history, isGrocery],
  );

  async function addLines(lines: string[]) {
    if (!activeId) return;
    const rows = lines
      .map(parseLine)
      .filter((r) => r.title && !onList.has(r.title.toLowerCase()))
      .map((r) => ({ list_id: activeId, title: r.title, quantity: r.quantity, category: categoryFor(r.title) }));
    if (!rows.length) return;
    await supabase.from("list_items").insert(rows);
    loadItems();
    loadHistory();
  }

  async function toggle(item: ListItem) {
    const { data: auth } = await supabase.auth.getUser();
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
    await supabase
      .from("list_items")
      .update({ done: !item.done, done_at: item.done ? null : new Date().toISOString(), done_by: item.done ? null : auth.user?.id })
      .eq("id", item.id);
  }

  async function remove(item: ListItem) {
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    await supabase.from("list_items").delete().eq("id", item.id);
  }

  async function clearDone() {
    if (!activeId || !confirm("Remove all checked items?")) return;
    await supabase.from("list_items").delete().eq("list_id", activeId).eq("done", true);
    loadItems();
  }

  async function newList() {
    const name = prompt("List name?");
    if (!name) return;
    const kind = confirm("Is it a shopping list? (OK = shopping, Cancel = to-do)") ? "grocery" : "todo";
    const { data } = await supabase.from("lists").insert({ name, kind, position: lists.length }).select().single<List>();
    if (data) {
      setLists((ls) => [...ls, data]);
      setActiveId(data.id);
    }
  }

  // Open items grouped by aisle (shopping lists) or flat (to-do lists).
  const groups = useMemo(() => {
    if (!isGrocery) return [{ id: "all", label: "", emoji: "", items: open }];
    const map = new Map<string, ListItem[]>();
    for (const i of open) {
      const c = categoryById(i.category).id;
      map.set(c, [...(map.get(c) ?? []), i]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
      .map(([id, its]) => ({ ...categoryById(id), items: its }));
  }, [open, isGrocery]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Lists</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveId(l.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${l.id === activeId ? "border-accent bg-accent text-white" : "border-border"}`}
          >
            {l.kind === "grocery" ? "🛒" : "✅"} {l.name}
          </button>
        ))}
        <button onClick={newList} className="shrink-0 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted">
          + New list
        </button>
      </div>

      {active && (
        <>
          <div className="relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addLines([title]);
                setTitle("");
              }}
              className="flex gap-2"
            >
              <input
                className="input"
                placeholder={isGrocery ? "Add item, e.g. 2 milk (paste a whole list too)" : "Add a to-do"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  if (lines.length > 1) {
                    e.preventDefault();
                    addLines(lines);
                  }
                }}
              />
              <button className="btn">Add</button>
            </form>
            {autocomplete.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {autocomplete.map((h) => (
                  <button
                    key={h.title}
                    className="btn-ghost"
                    onClick={() => {
                      const { quantity } = parseLine(title);
                      addLines([quantity ? `${quantity} ${h.title}` : h.title]);
                      setTitle("");
                    }}
                  >
                    + {h.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isGrocery && suggestions.length > 0 && (
            <section className="card border-dashed">
              <h2 className="font-semibold">🔮 Probably needed soon</h2>
              <p className="mb-2 text-xs text-muted">Based on how often you buy these. Tap to add.</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const d = daysUntil(s.next_due_on);
                  return (
                    <button key={s.item_key} className="btn-ghost" onClick={() => addLines([s.item_name])}>
                      + {s.item_name}
                      <span className="text-xs text-muted">{d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `in ${d}d`}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {open.length === 0 ? (
            <p className="card text-sm text-muted">All done 🎉</p>
          ) : (
            groups.map((g) => (
              <section key={g.id} className="card py-1">
                {g.label && (
                  <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {g.emoji} {g.label}
                  </h3>
                )}
                <ul className="divide-y divide-border">
                  {g.items.map((i) => (
                    <ItemRow key={i.id} item={i} onToggle={toggle} onEdit={setEditing} />
                  ))}
                </ul>
              </section>
            ))
          )}

          {done.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <button className="text-sm text-muted" onClick={() => setShowDone(!showDone)}>
                  {showDone ? "▾" : "▸"} Checked ({done.length})
                </button>
                <button className="text-sm text-muted" onClick={clearDone}>Clear</button>
              </div>
              {showDone && (
                <ul className="card mt-2 divide-y divide-border py-1 opacity-70">
                  {done.map((i) => (
                    <ItemRow key={i.id} item={i} onToggle={toggle} onEdit={setEditing} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit item">
        {editing && (
          <ItemForm
            item={editing}
            grocery={isGrocery}
            onDelete={() => {
              remove(editing);
              setEditing(null);
            }}
            onDone={() => {
              setEditing(null);
              loadItems();
              loadHistory();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ItemRow({ item, onToggle, onEdit }: { item: ListItem; onToggle: (i: ListItem) => void; onEdit: (i: ListItem) => void }) {
  const { addedBy } = useFamily();
  const by = addedBy(item.created_by);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onToggle(item)}
        aria-label={item.done ? "Uncheck" : "Check"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${item.done ? "border-accent bg-accent text-white" : "border-border"}`}
      >
        {item.done && "✓"}
      </button>
      <button className={`min-w-0 flex-1 text-left ${item.done ? "line-through" : ""}`} onClick={() => onEdit(item)}>
        <span>{item.title}</span>
        {item.quantity && <span className="ml-2 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs text-accent">{item.quantity}</span>}
        {item.due_date && <span className="ml-2 chip">{item.due_date}</span>}
        {(item.notes || by) && (
          <span className="block truncate text-xs text-muted">
            {item.notes}
            {item.notes && by ? " · " : ""}
            {by && `added by ${by}`}
          </span>
        )}
      </button>
      <MemberBadge id={item.assignee_member_id} />
    </li>
  );
}

function ItemForm({ item, grocery, onDone, onDelete }: { item: ListItem; grocery: boolean; onDone: () => void; onDelete: () => void }) {
  const { supabase } = useFamily();
  const [d, setD] = useState(item);
  const set = <K extends keyof ListItem>(k: K, v: ListItem[K]) => setD((x) => ({ ...x, [k]: v }));

  // +/- on the leading number, keeping any unit ("2 kg" → "3 kg").
  function bump(delta: number) {
    const m = (d.quantity ?? "").match(/^(\d+)(.*)$/);
    const n = Math.max(0, (m ? parseInt(m[1], 10) : 1) + delta);
    set("quantity", n <= 0 ? null : `${n}${m ? m[2] : ""}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase
      .from("list_items")
      .update({
        title: d.title.trim(),
        quantity: d.quantity?.trim() || null,
        notes: d.notes?.trim() || null,
        category: d.category,
        assignee_member_id: d.assignee_member_id,
        due_date: d.due_date,
      })
      .eq("id", d.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <input className="input" required value={d.title} onChange={(e) => set("title", e.target.value)} />
      <div>
        <span className="label">Quantity</span>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost w-12 text-lg" onClick={() => bump(-1)}>−</button>
          <input className="input text-center" placeholder="e.g. 2 or 1 kg" value={d.quantity ?? ""} onChange={(e) => set("quantity", e.target.value || null)} />
          <button type="button" className="btn-ghost w-12 text-lg" onClick={() => bump(1)}>+</button>
        </div>
      </div>
      <input className="input" placeholder="Note (e.g. for breakfast, organic)" value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      {grocery ? (
        <div>
          <span className="label">Aisle</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => set("category", c.id)}
                className={`rounded-full border px-3 py-1 text-sm ${categoryById(d.category).id === c.id ? "border-accent bg-accent text-white" : "border-border"}`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="label">Who</span>
            <MemberSelect value={d.assignee_member_id} onChange={(v) => set("assignee_member_id", v)} />
          </div>
          <div>
            <span className="label">Due</span>
            <input className="input" type="date" value={d.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn flex-1">Save</button>
        <button type="button" className="btn-ghost text-danger" onClick={onDelete}>Delete</button>
      </div>
    </form>
  );
}
