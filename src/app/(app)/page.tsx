"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { EventRow } from "@/components/event-row";
import { SendGift } from "@/components/send-gift";
import { addDays, dayKey, daysUntil, startOfDay } from "@/lib/dates";
import { fetchOccurrences, groupByDay } from "@/lib/events";
import type { EventOccurrence, Recipe, RestockSuggestion } from "@/lib/types";

export default function TodayPage() {
  const { supabase, profile } = useFamily();
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [tonight, setTonight] = useState<Recipe | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);

  useEffect(() => {
    const today = startOfDay(new Date());
    fetchOccurrences(supabase, today, addDays(today, 2)).then(setEvents);
    // "Tonight?": favourites first, then any recipe.
    supabase
      .from("recipes")
      .select("*")
      .then(({ data }) => {
        const all = (data ?? []) as Recipe[];
        const pool = all.filter((r) => r.favorite).length ? all.filter((r) => r.favorite) : all;
        setTonight(pool.length ? pool[Math.floor(Math.random() * pool.length)] : null);
      });
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
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const byDay = groupByDay(events);
  const today = byDay.get(todayKey) ?? [];
  const tomorrow = byDay.get(tomorrowKey) ?? [];
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
        {today.length === 0 ? <p className="py-1 text-sm text-muted">Nothing planned.</p> : <div className="divide-y divide-border">{today.map((e) => <EventRow key={e.key} ev={e} day={todayKey} />)}</div>}
      </section>

      {tomorrow.length > 0 && (
        <section className="card">
          <h2 className="h2">Tomorrow</h2>
          <div className="divide-y divide-border">{tomorrow.map((e) => <EventRow key={e.key} ev={e} day={tomorrowKey} />)}</div>
        </section>
      )}

      <SendGift />

      <Link href="/recipes" className="card flex items-center justify-between">
        <div>
          <h2 className="h2">🍽 Tonight?</h2>
          <p className="text-sm text-muted">
            {tonight ? `${tonight.title}${tonight.prep_minutes ? ` · ${tonight.prep_minutes} min` : ""}` : "Add a few recipes to get ideas here."}
          </p>
        </div>
        <span className="text-muted">→</span>
      </Link>

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
