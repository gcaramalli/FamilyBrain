"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/family-context";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import type { PrivateBoard, PrivateItem } from "@/lib/types";

// Starting tiles, offered until the person makes their own.
const SUGGESTED: Pick<PrivateBoard, "emoji" | "title" | "kind">[] = [
  { emoji: "✅", title: "To-do", kind: "list" },
  { emoji: "🎁", title: "Gift ideas", kind: "list" },
  { emoji: "📝", title: "Notes", kind: "note" },
  { emoji: "💼", title: "Work", kind: "list" },
];

type Draft = Pick<PrivateBoard, "emoji" | "title" | "kind">;

// My own corner: tiles of to-dos, notes and ideas (Christmas presents…) that
// nobody else in the family sees. Not read by the Claude connector either.
export default function PrivatePage() {
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">🔒 {t("Private")}</h1>
        <button className="btn" onClick={() => setCreating({ emoji: "📝", title: "", kind: "list" })}>+ {t("Tile")}</button>
      </div>
      <p className="text-sm text-muted">{t("Only you can see this space, not the rest of the family.")}</p>

      {boards && (
        <div className="grid grid-cols-2 gap-3">
          {boards.map((b) => {
            const mine = items.filter((i) => i.board_id === b.id);
            const left = mine.filter((i) => !i.done);
            const preview =
              b.kind === "note"
                ? b.body.trim().split("\n")[0] || t("Empty")
                : left.length
                  ? left.slice(0, 3).map((i) => i.title).join(" · ")
                  : t("Empty");
            return (
              <button key={b.id} onClick={() => setOpenId(b.id)} className="card flex min-h-28 flex-col gap-1 p-3 text-left">
                <span className="text-2xl leading-none">{b.emoji}</span>
                <span className="flex items-baseline justify-between gap-2 font-medium">
                  <span className="truncate">{b.title}</span>
                  {b.kind === "list" && left.length > 0 && <span className="shrink-0 text-xs tabular-nums text-muted">{left.length}</span>}
                </span>
                <span className="line-clamp-2 text-sm text-muted">{preview}</span>
              </button>
            );
          })}
          {unused.map((s) => (
            <button
              key={s.title}
              onClick={() => create({ ...s, title: t(s.title) })}
              className="flex min-h-28 flex-col gap-1 rounded-2xl border border-dashed border-border p-3 text-left text-muted"
            >
              <span className="text-2xl leading-none opacity-60">{s.emoji}</span>
              <span className="font-medium">+ {t(s.title)}</span>
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
            <div className="grid grid-cols-2 rounded-xl border border-border bg-surface p-0.5 text-sm">
              {(["list", "note"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setCreating({ ...creating, kind: k })}
                  className={`min-h-9 rounded-lg ${creating.kind === k ? "bg-accent font-medium text-on-accent" : ""}`}
                >
                  {k === "list" ? `☑️ ${t("List")}` : `📝 ${t("Note")}`}
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
    </div>
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
      {board.kind === "note" ? (
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
