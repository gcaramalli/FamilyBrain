"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/family-context";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import type { PrivateBoard, PrivateItem } from "@/lib/types";

// Tile tints, in order: the space looks like a box of coloured cards.
const TINTS = ["#2fc2b0", "#f2b441", "#e07ab4", "#9b7bf0", "#4f9bf5", "#f5904a", "#3fbf7f", "#f0826f"];

// Starting tiles, offered until the person makes their own.
const SUGGESTED: Pick<PrivateBoard, "emoji" | "title" | "kind">[] = [
  { emoji: "✅", title: "To-do", kind: "list" },
  { emoji: "🎁", title: "Gift ideas", kind: "gifts" },
  { emoji: "📝", title: "Notes", kind: "note" },
  { emoji: "💼", title: "Work", kind: "list" },
];

type Draft = Pick<PrivateBoard, "emoji" | "title" | "kind">;

// My own corner: tiles of to-dos, notes and ideas (Christmas presents…) that
// nobody else in the family sees. Not read by the Claude connector either.
export function PrivateSpace() {
  const { supabase, t } = useFamily();
  const toast = useToast();
  const [boards, setBoards] = useState<PrivateBoard[] | null>(null);
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const [b, i] = await Promise.all([
      supabase.from("private_boards").select("*").order("position").order("created_at"),
      supabase.from("private_items").select("*").order("created_at"),
    ]);
    setBoards((b.data ?? []) as PrivateBoard[]);
    setItems((i.data ?? []) as PrivateItem[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const open = boards?.find((b) => b.id === openId) ?? null;

  async function create(d: Draft) {
    const title = d.title.trim();
    if (!title) return;
    const position = (boards ?? []).reduce((m, b) => Math.max(m, b.position + 1), 0);
    const { data } = await supabase.from("private_boards").insert({ ...d, title, position }).select().single();
    setCreating(null);
    await load();
    if (data) setOpenId(data.id);
  }

  async function removeBoard(board: PrivateBoard) {
    const kept = items.filter((i) => i.board_id === board.id);
    await supabase.from("private_boards").delete().eq("id", board.id);
    setOpenId(null);
    load();
    toast(t("Tile deleted"), async () => {
      await supabase.from("private_boards").insert(board);
      if (kept.length) await supabase.from("private_items").insert(kept);
      load();
    });
  }

  const unused = SUGGESTED.filter((s) => !boards?.some((b) => b.title === t(s.title)));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="h2">{t("Private")}</h2>
          <p className="text-sm text-muted">{t("Only you can see this.")}</p>
        </div>
        <button className="btn-ghost" onClick={() => setCreating({ emoji: "📝", title: "", kind: "list" })}>+ {t("Tile")}</button>
      </div>

      {boards && (
        <div className="grid grid-cols-2 gap-3">
          {boards.map((b, n) => {
            const tint = TINTS[n % TINTS.length];
            // No preview of the content: someone may be looking over my shoulder.
            const left = items.filter((i) => i.board_id === b.id && !i.done).length;
            return (
              <button
                key={b.id}
                onClick={() => setOpenId(b.id)}
                className="flex min-h-28 flex-col justify-between gap-2 rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]"
                style={{ background: `color-mix(in srgb, ${tint} 22%, var(--surface))` }}
              >
                <span className="min-w-0">
                  <span className="line-clamp-2 block font-bold leading-tight">{b.title}</span>
                  {b.kind !== "note" && left > 0 && <span className="text-sm tabular-nums text-muted">{left}</span>}
                </span>
                <span className="self-end text-3xl leading-none">{b.emoji}</span>
              </button>
            );
          })}
          {unused.map((s) => (
            <button
              key={s.title}
              onClick={() => create({ ...s, title: t(s.title) })}
              className="flex min-h-28 flex-col justify-between gap-2 rounded-[22px] border border-dashed border-border p-4 text-left text-muted"
            >
              <span className="font-bold">+ {t(s.title)}</span>
              <span className="self-end text-3xl leading-none opacity-50">{s.emoji}</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!creating} onClose={() => setCreating(null)} title={t("New tile")}>
        {creating && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create(creating);
            }}
          >
            <div className="flex gap-2">
              <input
                className="input w-16 text-center text-xl"
                value={creating.emoji}
                onChange={(e) => setCreating({ ...creating, emoji: e.target.value })}
                aria-label={t("Emoji")}
                maxLength={16}
              />
              <input
                className="input"
                autoFocus
                placeholder={t("e.g. Christmas presents")}
                value={creating.title}
                onChange={(e) => setCreating({ ...creating, title: e.target.value })}
                maxLength={80}
              />
            </div>
            <div className="grid grid-cols-3 rounded-full bg-accent-soft p-1 text-sm">
              {(["list", "gifts", "note"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setCreating({ ...creating, kind: k })}
                  className={`min-h-9 rounded-full ${creating.kind === k ? "bg-[var(--pill)] font-semibold shadow-sm" : "text-muted"}`}
                >
                  {k === "list" ? t("List") : k === "gifts" ? t("Gifts") : t("Note")}
                </button>
              ))}
            </div>
            <button className="btn" disabled={!creating.title.trim()}>{t("Create")}</button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.emoji} ${open.title}` : ""}>
        {open && (
          <BoardView
            key={open.id}
            board={open}
            items={items.filter((i) => i.board_id === open.id)}
            onChanged={load}
            onDelete={() => removeBoard(open)}
          />
        )}
      </Sheet>
    </section>
  );
}

function BoardView({ board, items, onChanged, onDelete }: { board: PrivateBoard; items: PrivateItem[]; onChanged: () => void; onDelete: () => void }) {
  const { supabase, t } = useFamily();
  const toast = useToast();
  const [title, setTitle] = useState(board.title);
  const [body, setBody] = useState(board.body);
  const [adding, setAdding] = useState("");

  // Notes save themselves a moment after typing stops (and on blur).
  const saved = useRef(board.body);
  useEffect(() => {
    if (body === saved.current) return;
    const timer = setTimeout(() => {
      saved.current = body;
      supabase.from("private_boards").update({ body, updated_at: new Date().toISOString() }).eq("id", board.id).then(onChanged);
    }, 800);
    return () => clearTimeout(timer);
  }, [body, board.id, supabase, onChanged]);

  async function saveBoard(fields: Partial<PrivateBoard>) {
    await supabase.from("private_boards").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", board.id);
    onChanged();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // Paste several lines at once: one item each.
    const lines = adding.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
    if (!lines.length) return;
    setAdding("");
    await supabase.from("private_items").insert(lines.map((l) => ({ board_id: board.id, title: l.slice(0, 500) })));
    onChanged();
  }

  async function toggle(item: PrivateItem) {
    await supabase.from("private_items").update({ done: !item.done }).eq("id", item.id);
    onChanged();
  }

  async function remove(item: PrivateItem) {
    await supabase.from("private_items").delete().eq("id", item.id);
    onChanged();
    toast(t("Deleted"), async () => {
      await supabase.from("private_items").insert(item);
      onChanged();
    });
  }

  const sorted = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];

  return (
    <div className="flex flex-col gap-3">
      <input
        className="input font-medium"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title.trim() !== board.title && saveBoard({ title: title.trim() })}
        aria-label={t("Title")}
        maxLength={80}
      />
      {board.kind === "gifts" ? (
        <GiftIdeas board={board} items={items} onChanged={onChanged} onToggle={toggle} onRemove={remove} />
      ) : board.kind === "note" ? (
        <textarea
          className="input min-h-64"
          value={body}
          placeholder={t("Write anything…")}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => {
            if (body === saved.current) return;
            saved.current = body;
            saveBoard({ body });
          }}
          maxLength={20000}
        />
      ) : (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input className="input" placeholder={t("Add…")} value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={5000} />
            <button className="btn" disabled={!adding.trim()} aria-label={t("Add")}>+</button>
          </form>
          <ul className="divide-y divide-border">
            {sorted.map((i) => (
              <li key={i.id} className="flex min-h-12 items-center gap-3">
                <button
                  onClick={() => toggle(i)}
                  aria-label={i.done ? t("Mark as not done") : t("Mark as done")}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs ${i.done ? "border-foreground bg-foreground text-background" : "border-border"}`}
                >
                  {i.done ? "✓" : ""}
                </button>
                <span className={`min-w-0 flex-1 break-words ${i.done ? "text-muted line-through" : ""}`}>{i.title}</span>
                <button onClick={() => remove(i)} aria-label={t("Delete")} className="flex h-9 w-9 shrink-0 items-center justify-center text-muted">
                  ✕
                </button>
              </li>
            ))}
            {!items.length && <li className="py-3 text-sm text-muted">{t("Nothing yet.")}</li>}
          </ul>
        </>
      )}
      <button className="btn-ghost self-start text-danger" onClick={onDelete}>{t("Delete this tile")}</button>
    </div>
  );
}

// Gift ideas grouped by who they are for, each with an optional occasion.
// Ticked = bought. Names are free text (friends' kids are not members), with
// the family and the occasions' people suggested.
function GiftIdeas({
  board,
  items,
  onChanged,
  onToggle,
  onRemove,
}: {
  board: PrivateBoard;
  items: PrivateItem[];
  onChanged: () => void;
  onToggle: (i: PrivateItem) => void;
  onRemove: (i: PrivateItem) => void;
}) {
  const { supabase, members, me, t } = useFamily();
  const [idea, setIdea] = useState("");
  const [person, setPerson] = useState("");
  const [occasion, setOccasion] = useState("");
  const [showBought, setShowBought] = useState(false);

  const people = [...new Set([...members.filter((m) => m.id !== me?.id).map((m) => m.name), ...items.map((i) => i.person ?? "").filter(Boolean)])];
  const occasions = [...new Set([t("Christmas"), t("Birthday"), ...items.map((i) => i.occasion ?? "").filter(Boolean)])];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim()) return;
    await supabase.from("private_items").insert({
      board_id: board.id,
      title: idea.trim().slice(0, 500),
      person: person.trim() || null,
      occasion: occasion.trim() || null,
    });
    setIdea(""); // keep the person and occasion: ideas often come in batches
    onChanged();
  }

  const shown = items.filter((i) => showBought || !i.done);
  const groups = new Map<string, PrivateItem[]>();
  for (const i of shown) {
    const key = i.person?.trim() || "";
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const order = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const bought = items.filter((i) => i.done).length;

  return (
    <>
      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border border-border p-2">
        <input className="input" placeholder={t("Gift idea")} value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={500} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" list="gift-people" placeholder={t("For whom?")} value={person} onChange={(e) => setPerson(e.target.value)} maxLength={80} />
          <input className="input" list="gift-occasions" placeholder={t("Occasion")} value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={80} />
        </div>
        <datalist id="gift-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="gift-occasions">{occasions.map((o) => <option key={o} value={o} />)}</datalist>
        <button className="btn" disabled={!idea.trim()}>+ {t("Add")}</button>
      </form>

      {order.map((key) => (
        <section key={key || "-"}>
          <h3 className="flex items-baseline justify-between border-b border-border pb-1 text-sm font-semibold">
            <span>{key || t("Not decided yet")}</span>
            <span className="font-normal tabular-nums text-muted">{groups.get(key)!.length}</span>
          </h3>
          <ul className="divide-y divide-border">
            {groups.get(key)!.map((i) => (
              <li key={i.id} className="flex min-h-12 items-center gap-3">
                <button
                  onClick={() => onToggle(i)}
                  aria-label={i.done ? t("Mark as not bought") : t("Mark as bought")}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs ${i.done ? "border-foreground bg-foreground text-background" : "border-border"}`}
                >
                  {i.done ? "✓" : ""}
                </button>
                <span className={`min-w-0 flex-1 break-words ${i.done ? "text-muted line-through" : ""}`}>
                  {i.title}
                  {i.occasion && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">{i.occasion}</span>}
                </span>
                <button onClick={() => onRemove(i)} aria-label={t("Delete")} className="flex h-9 w-9 shrink-0 items-center justify-center text-muted">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!items.length && <p className="text-sm text-muted">{t("Note an idea as soon as you have it, with who it's for.")}</p>}
      {bought > 0 && (
        <button className="self-start text-sm text-muted underline" onClick={() => setShowBought(!showBought)}>
          {showBought ? t("Hide bought") : t("Show bought ({n})", { n: bought })}
        </button>
      )}
    </>
  );
}
