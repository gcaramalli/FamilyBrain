"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { EventRow } from "@/components/event-row";
import { addDays, dayKey, daysUntil, startOfDay } from "@/lib/dates";
import type { CalendarEvent, RestockSuggestion } from "@/lib/types";

export default function TodayPage() {
  const { supabase, profile } = useFamily();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);

  useEffect(() => {
    const today = startOfDay(new Date());
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", today.toISOString())
      .lt("starts_at", addDays(today, 2).toISOString())
      .order("starts_at")
      .then(({ data }) => setEvents((data ?? []) as CalendarEvent[]));
    supabase
      .from("list_items")
      .select("id, lists!inner(kind)", { count: "exact", head: true })
      .eq("done", false)
      .eq("lists.kind", "grocery")
      .then(({ count }) => setOpenCount(count ?? 0));
    supabase
      .from("restock_suggestions")
      .select("*")
      .order("next_due_on")
      .then(({ data }) => setRestock(((data ?? []) as RestockSuggestion[]).filter((r) => daysUntil(r.next_due_on) <= 3)));
  }, [supabase]);

  const todayKey = dayKey(new Date());
  const today = events.filter((e) => dayKey(e.starts_at) === todayKey);
  const tomorrow = events.filter((e) => dayKey(e.starts_at) !== todayKey);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Hi" : "Good evening";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="h1">{greeting}, {profile.display_name || "there"} 👋</h1>
        <p className="text-muted capitalize">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="h2">Today</h2>
          <Link href="/calendar" className="text-sm text-accent">Calendar →</Link>
        </div>
        {today.length === 0 ? <p className="py-1 text-sm text-muted">Nothing planned.</p> : <div className="divide-y divide-border">{today.map((e) => <EventRow key={e.id} ev={e} />)}</div>}
      </section>

      {tomorrow.length > 0 && (
        <section className="card">
          <h2 className="h2">Tomorrow</h2>
          <div className="divide-y divide-border">{tomorrow.map((e) => <EventRow key={e.id} ev={e} />)}</div>
        </section>
      )}

      <Link href="/lists" className="card flex items-center justify-between">
        <div>
          <h2 className="h2">🛒 Shopping</h2>
          <p className="text-sm text-muted">
            {openCount === null ? "…" : `${openCount} item${openCount === 1 ? "" : "s"} to buy`}
            {restock.length > 0 && ` · ${restock.length} probably running out`}
          </p>
        </div>
        <span className="text-muted">→</span>
      </Link>

      {restock.length > 0 && (
        <section className="card border-dashed">
          <h2 className="font-semibold">🔮 Running out soon</h2>
          <p className="mt-1 text-sm text-muted">{restock.map((r) => r.item_name).join(", ")}</p>
        </section>
      )}
    </div>
  );
}
