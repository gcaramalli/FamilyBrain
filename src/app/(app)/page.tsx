"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { CareSlot } from "@/components/care-slot";
import { EventRow } from "@/components/event-row";
import { HubTile } from "@/components/hub-tile";
import { SendGift } from "@/components/send-gift";
import { CARE_KINDS, careKind, fetchAvailability, findSlot, isCareDay, slotAvailability } from "@/lib/care";
import { addDays, dayKey, daysUntil, fmtDate, startOfDay } from "@/lib/dates";
import { groupByDay } from "@/lib/events";
import { daysAway, fetchCalendar, fetchOccasions, OCCASION_EMOJI, occasionLabel, upcoming } from "@/lib/occasions";
import { whenLabel } from "@/components/occasions-panel";
import type { CareAvailability, EventOccurrence, Member, Occasion, RestockSuggestion } from "@/lib/types";

export default function TodayPage() {
  const { supabase, profile, kids, members, me, t } = useFamily();
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [answers, setAnswers] = useState<CareAvailability[]>([]);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [restock, setRestock] = useState<RestockSuggestion[]>([]);

  const loadEvents = useCallback(async () => {
    const today = startOfDay(new Date());
    // A week ahead: the kids' card shows the next preschool day, even after a weekend.
    const [evs, said] = await Promise.all([
      fetchCalendar(supabase, members, today, addDays(today, 8), t),
      fetchAvailability(supabase, dayKey(today), dayKey(addDays(today, 8))),
    ]);
    setEvents(evs);
    setAnswers(said);
  }, [supabase, members, t]);

  useEffect(() => {
    loadEvents();
    fetchOccasions(supabase).then(setOccasions);
    const channel = supabase
      .channel("today-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_availability" }, loadEvents)
      .subscribe();
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
        <KidCard key={kid.id} kid={kid} events={events} answers={answers} onChanged={loadEvents} />
      ))}

      {/* What's coming in the next day or so. Kids' care is in their card above. */}
      <section>
        <h2 className="h2">{t("Coming up")}</h2>
        {today.length === 0 && tomorrow.length === 0 && <p className="py-2 text-sm text-muted">{t("Nothing else planned.")}</p>}
        {today.length > 0 && <div className="divide-y divide-border">{today.map((e) => <EventRow key={e.key} ev={e} day={todayKey} />)}</div>}
        {tomorrow.length > 0 && (
          <>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("Tomorrow")}</h3>
            <div className="divide-y divide-border">{tomorrow.map((e) => <EventRow key={e.key} ev={e} day={tomorrowKey} />)}</div>
          </>
        )}
      </section>

      <SoonCard occasions={occasions} meId={me?.id} />

      <nav className="grid grid-cols-2 gap-3">
        <HubTile
          href="/lists"
          module="shopping"
          title={t("Shopping")}
          sub={
            (openCount === null ? "…" : openCount === 1 ? t("1 item to buy") : t("{n} items to buy", { n: openCount })) +
            (restock.length > 0 ? ` · ${t("probably running out: {items}", { items: restock.map((r) => r.item_name).join(", ") })}` : "")
          }
        />
        <HubTile href="/brain" module="brain" title={t("Family brain")} sub={t("Notes and dates worth remembering")} />
      </nav>

      <SendGift />
    </div>
  );
}

// "Charlie · today: drop-off Guillaume 08:00, pick-up ? 16:00", then the
// next preschool day (tomorrow, or Monday after a weekend).
function KidCard({ kid, events, answers, onChanged }: { kid: Member; events: EventOccurrence[]; answers: CareAvailability[]; onChanged: () => void }) {
  const { t } = useFamily();
  const hasCare = (d: Date) => isCareDay(kid, d) || CARE_KINDS.some((kind) => findSlot(events, kid, dayKey(d), kind));
  const next = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1)).find(hasCare);
  const days = [
    { label: t("Today"), date: new Date() },
    ...(next
      ? [{ label: dayKey(next) === dayKey(addDays(new Date(), 1)) ? t("Tomorrow") : fmtDate(next, { weekday: "long" }), date: next }]
      : []),
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
            <p key={k} className="text-sm">
              <span className="font-medium">{label}</span> <span className="text-muted">· {t("No preschool")}</span>
            </p>
          );
        }
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium capitalize">
              {label}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {CARE_KINDS.map((kind, i) => (
                <CareSlot key={kind} kid={kid} day={k} kind={kind} event={planned[i]} availability={slotAvailability(answers, kid, k, kind)} onChanged={onChanged} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Friends' weddings and birthdays in the coming week (only those that concern me).
function SoonCard({ occasions, meId }: { occasions: Occasion[]; meId?: string }) {
  const { t } = useFamily();
  const soon = upcoming(occasions, 7).filter(({ o }) => !o.ours && (!o.member_ids.length || !meId || o.member_ids.includes(meId)));
  if (!soon.length) return null;
  return (
    <Link href="/brain?tab=dates" className="card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("Soon")}</h2>
        <span className="text-muted">→</span>
      </div>
      {soon.map(({ o, day, years }) => (
        <p key={o.id} className="text-sm">
          {OCCASION_EMOJI[o.kind]} <span className="font-medium">{o.title}</span>{" "}
          <span className="text-muted">· {occasionLabel(t, o.kind, years)} · {whenLabel(t, daysAway(day), day)}</span>
        </p>
      ))}
    </Link>
  );
}
