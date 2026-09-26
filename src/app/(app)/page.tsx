"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { CareSlot } from "@/components/care-slot";
import { EventRow } from "@/components/event-row";
import { SendGift } from "@/components/send-gift";
import { CARE_KINDS, careKind, findSlot, isCareDay } from "@/lib/care";
import { addDays, dayKey, daysUntil, fmtDate, startOfDay } from "@/lib/dates";
import { fetchOccurrences, groupByDay } from "@/lib/events";
import type { EventOccurrence, Member, Recipe, RestockSuggestion } from "@/lib/types";

export default function TodayPage() {
  const { supabase, profile, kids, t } = useFamily();
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [tonight, setTonight] = useState<Recipe | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);

  const loadEvents = useCallback(async () => {
    const today = startOfDay(new Date());
    setEvents(await fetchOccurrences(supabase, today, addDays(today, 2)));
  }, [supabase]);

  useEffect(() => {
    loadEvents();
    const channel = supabase
      .channel("today-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadEvents)
      .subscribe();
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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadEvents]);

  const todayKey = dayKey(new Date());
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const byDay = groupByDay(events);
  // Kids' drop-offs and pick-ups are in the card at the top, not repeated below.
  const isKidCare = (e: EventOccurrence) => careKind(e) !== null && kids.some((k) => k.id === e.for_member_id);
  const today = (byDay.get(todayKey) ?? []).filter((e) => !isKidCare(e));
  const tomorrow = (byDay.get(tomorrowKey) ?? []).filter((e) => !isKidCare(e));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("Good morning") : hour < 18 ? t("Hi") : t("Good evening");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm capitalize text-muted">{fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="h1">{greeting}, {profile.display_name || t("there")}</h1>
      </div>

      {kids.map((kid) => (
        <KidCard key={kid.id} kid={kid} events={events} onChanged={loadEvents} />
      ))}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="h2">{t("Today")}</h2>
          <Link href="/calendar" className="text-sm font-medium text-accent">{t("Calendar")} →</Link>
        </div>
        {today.length === 0 ? (
          <p className="py-2 text-sm text-muted">{t("Nothing else planned.")}</p>
        ) : (
          <div className="divide-y divide-border">{today.map((e) => <EventRow key={e.key} ev={e} day={todayKey} />)}</div>
        )}
      </section>

      {tomorrow.length > 0 && (
        <section>
          <h2 className="h2">{t("Tomorrow")}</h2>
          <div className="divide-y divide-border">{tomorrow.map((e) => <EventRow key={e.key} ev={e} day={tomorrowKey} />)}</div>
        </section>
      )}

      <nav className="card divide-y divide-border py-1">
        <Link href="/lists" className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium">🛒 {t("Shopping")}</div>
            <p className="text-sm text-muted">
              {openCount === null ? "…" : openCount === 1 ? t("1 item to buy") : t("{n} items to buy", { n: openCount })}
              {restock.length > 0 && ` · ${t("probably running out: {items}", { items: restock.map((r) => r.item_name).join(", ") })}`}
            </p>
          </div>
          <span className="text-muted">→</span>
        </Link>
        <Link href="/recipes" className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium">🍽 {t("Tonight?")}</div>
            <p className="text-sm text-muted">
              {tonight ? `${tonight.title}${tonight.prep_minutes ? ` · ${tonight.prep_minutes} min` : ""}` : t("Add a few recipes to get ideas here.")}
            </p>
          </div>
          <span className="text-muted">→</span>
        </Link>
      </nav>

      <SendGift />
    </div>
  );
}

// "Charlie · today: drop-off Guillaume 08:00, pick-up ? 16:00", then tomorrow.
function KidCard({ kid, events, onChanged }: { kid: Member; events: EventOccurrence[]; onChanged: () => void }) {
  const { t } = useFamily();
  const days = [
    { label: t("Today"), date: new Date() },
    { label: t("Tomorrow"), date: addDays(new Date(), 1) },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: `color-mix(in srgb, ${kid.color} 10%, var(--surface))` }}>
      <div className="flex items-baseline justify-between">
        <h2 className="h2">{kid.emoji} {kid.name}</h2>
        <Link href="/kids" className="text-sm font-medium text-accent">{t("Plan the week")} →</Link>
      </div>
      {days.map(({ label, date }) => {
        const k = dayKey(date);
        const planned = CARE_KINDS.map((kind) => findSlot(events, kid, k, kind));
        if (!isCareDay(kid, date) && !planned.some(Boolean)) {
          return (
            <div key={k} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-medium">{label}</span>
              <span className="text-sm text-muted">{t("No preschool")}</span>
            </div>
          );
        }
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            <div className="grid grid-cols-2 gap-2">
              {CARE_KINDS.map((kind, i) => (
                <CareSlot key={kind} kid={kid} day={k} kind={kind} event={planned[i]} onChanged={onChanged} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
