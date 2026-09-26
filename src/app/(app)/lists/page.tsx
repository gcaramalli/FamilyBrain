"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { MemberBadge } from "@/components/member-select";
import { daysUntil } from "@/lib/dates";
import type { List, ListItem, RestockSuggestion } from "@/lib/types";

export default function ListsPage() {
  const { supabase } = useFamily();
  const [lists, setLists] = useState<List[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);

  const active = lists.find((l) => l.id === activeId) ?? null;

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

  useEffect(() => {
    loadItems();
    loadRestock();
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
  }, [supabase, loadItems, loadRestock]);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  // Items the family usually buys that are due within a week and not already on the list.
  const suggestions = useMemo(() => {
    const onList = new Set(open.map((i) => i.title.trim().toLowerCase()));
    return restock.filter((r) => daysUntil(r.next_due_on) <= 7 && !onList.has(r.item_key));
  }, [restock, open]);

  async function add(text: string) {
    if (!activeId || !text.trim()) return;
    // "2 milk" → quantity "2", title "milk"
    const m = text.trim().match(/^(\d+(?:[.,]\d+)?\s*(?:x|st|kg|g|l|dl|pcs)?)\s+(.+)$/i);
    const row = m ? { title: m[2], quantity: m[1] } : { title: text.trim(), quantity: null };
    await supabase.from("list_items").insert({ list_id: activeId, ...row });
    loadItems();
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add(title);
              setTitle("");
            }}
            className="flex gap-2"
          >
            <input className="input" placeholder={active.kind === "grocery" ? "Add item, e.g. 2 milk" : "Add a to-do"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn">Add</button>
          </form>

          {active.kind === "grocery" && suggestions.length > 0 && (
            <section className="card border-dashed">
              <h2 className="font-semibold">🔮 Probably needed soon</h2>
              <p className="mb-2 text-xs text-muted">Based on how often you buy these. Tap to add.</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const d = daysUntil(s.next_due_on);
                  return (
                    <button key={s.item_key} className="btn-ghost" onClick={() => add(s.item_name)}>
                      + {s.item_name}
                      <span className="text-xs text-muted">{d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `in ${d}d`}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <ul className="card divide-y divide-border py-1">
            {open.length === 0 && <li className="py-3 text-sm text-muted">All done 🎉</li>}
            {open.map((i) => (
              <ItemRow key={i.id} item={i} onToggle={toggle} onRemove={remove} />
            ))}
          </ul>

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
                    <ItemRow key={i.id} item={i} onToggle={toggle} onRemove={remove} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ItemRow({ item, onToggle, onRemove }: { item: ListItem; onToggle: (i: ListItem) => void; onRemove: (i: ListItem) => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onToggle(item)}
        aria-label={item.done ? "Uncheck" : "Check"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${item.done ? "border-accent bg-accent text-white" : "border-border"}`}
      >
        {item.done && "✓"}
      </button>
      <div className={`min-w-0 flex-1 ${item.done ? "line-through" : ""}`}>
        <span>{item.title}</span>
        {item.quantity && <span className="ml-2 text-sm text-muted">{item.quantity}</span>}
        {item.due_date && <span className="ml-2 chip">{item.due_date}</span>}
      </div>
      <MemberBadge id={item.assignee_member_id} />
      <button onClick={() => onRemove(item)} className="px-1 text-muted" aria-label="Delete">✕</button>
    </li>
  );
}
