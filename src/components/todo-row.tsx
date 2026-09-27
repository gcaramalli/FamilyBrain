"use client";

import Link from "next/link";
import { useFamily } from "./family-context";
import { MemberBadge } from "./member-select";
import { useToast } from "./toast";
import { dayKey } from "@/lib/dates";
import { MODULES } from "@/lib/modules";
import type { ListItem } from "@/lib/types";

// Open to-dos due up to `until` (YYYY-MM-DD). Overdue ones are included: they
// are shown on today, marked late, until someone checks them off.
export async function fetchDueTodos(supabase: ReturnType<typeof useFamily>["supabase"], until: string) {
  const { data } = await supabase
    .from("list_items")
    .select("*, lists!inner(kind)")
    .eq("lists.kind", "todo")
    .eq("done", false)
    .not("due_date", "is", null)
    .lte("due_date", until)
    .order("due_date");
  return ((data ?? []) as ListItem[]).filter((i) => i.due_date);
}

// The day a to-do shows on: its due day, or today once it's late.
export const todoDay = (i: ListItem) => {
  const today = dayKey(new Date());
  return i.due_date && i.due_date < today ? today : i.due_date ?? today;
};

// One to-do in the calendar or on Today: tick it off in place (with Undo).
export function TodoRow({ item, onDone }: { item: ListItem; onDone: (i: ListItem, done: boolean) => void }) {
  const { supabase, t } = useFamily();
  const toast = useToast();
  const late = !!item.due_date && item.due_date < dayKey(new Date());

  async function check() {
    onDone(item, true);
    await supabase.from("list_items").update({ done: true, done_at: new Date().toISOString() }).eq("id", item.id);
    toast(t("Done: {item}", { item: item.title }), async () => {
      await supabase.from("list_items").update({ done: false, done_at: null }).eq("id", item.id);
      onDone(item, false);
    });
  }

  return (
    <li className="flex min-h-11 items-center gap-3">
      <button onClick={check} aria-label={t("Mark as done")} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
        <span className="h-5 w-5 rounded-md border-[1.5px]" style={{ borderColor: late ? "var(--danger)" : MODULES.todo.color }} />
      </button>
      <Link href="/todo" className="min-w-0 flex-1 truncate">
        {item.title}
        {late && <span className="ml-2 text-xs font-medium text-danger">{t("late")}</span>}
      </Link>
      <MemberBadge id={item.assignee_member_id} />
    </li>
  );
}
