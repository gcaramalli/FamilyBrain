"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFamily } from "@/components/family-context";
import { CareSlot } from "@/components/care-slot";
import { EventForm } from "@/components/event-form";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { assignSlot, CARE_KINDS, fetchAvailability, findSlot, isCareDay, setAvailability, slotAvailability } from "@/lib/care";
import { addDays, dayKey, fmtDate, startOfDay } from "@/lib/dates";
import { fetchOccurrences } from "@/lib/events";
import type { CareAvailability, EventOccurrence, Member } from "@/lib/types";

const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

// Who takes the kids to preschool and who fetches them, planned week by week.
export default function KidsPage() {
  const { supabase, kids, me, t } = useFamily();
  const toast = useToast();
  const [kidId, setKidId] = useState<string | null>(kids[0]?.id ?? null);
  // Open on the week still to plan: after the last preschool day (e.g. on a
  // Saturday), that's next week.
  const [weekStart, setWeekStart] = useState(() => {
    const now = startOfWeek(new Date());
    const kid0 = kids[0];
    const rest = Array.from({ length: 7 }, (_, i) => addDays(now, i)).filter((d) => d >= startOfDay(new Date()));
    return kid0 && !rest.some((d) => isCareDay(kid0, d)) ? addDays(now, 7) : now;
  });
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [upcoming, setUpcoming] = useState<EventOccurrence[]>([]);
  const [answers, setAnswers] = useState<CareAvailability[]>([]);
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
  const [settings, setSettings] = useState(false);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const weekKey = dayKey(weekStart);

  const load = useCallback(async () => {
    const start = new Date(weekKey + "T00:00:00");
    const today = startOfDay(new Date());
    const [week, next, said] = await Promise.all([
      fetchOccurrences(supabase, start, addDays(start, 7)),
      fetchOccurrences(supabase, today, addDays(today, 14)),
      fetchAvailability(supabase, weekKey, dayKey(addDays(start, 7))),
    ]);
    setEvents(week);
    setUpcoming(next);
    setAnswers(said);
  }, [supabase, weekKey]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("kids-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_availability" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(weekKey + "T00:00:00"), i)), [weekKey]);
  const todayKey = dayKey(new Date());

  // Slots in the next two weeks that nobody has confirmed yet.
  const open = useMemo(() => {
    if (!kid) return 0;
    let n = 0;
    for (let i = 0; i < 14; i++) {
      const d = addDays(startOfDay(new Date()), i);
      if (!isCareDay(kid, d)) continue;
      for (const kind of CARE_KINDS) if (!findSlot(upcoming, kid, dayKey(d), kind)?.responsible_member_id) n++;
    }
    return n;
  }, [upcoming, kid]);

  if (!kid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="h1">{t("Kids")}</h1>
        <p className="card text-muted">{t("Add your children in Admin → Family members (they don't need an account) to plan drop-offs and pick-ups here.")}</p>
      </div>
    );
  }

  // Everyone's "I can / I can't" carries over. Only my own "I'm going" is
  // copied as confirmed: the other parent confirms theirs themselves.
  async function copyToNextWeek() {
    let copied = 0;
    const nextStart = addDays(new Date(weekKey + "T00:00:00"), 7);
    const [laterEvents, laterAnswers] = await Promise.all([
      fetchOccurrences(supabase, nextStart, addDays(nextStart, 7)),
      fetchAvailability(supabase, dayKey(nextStart), dayKey(addDays(nextStart, 7))),
    ]);
    for (const d of days) {
      for (const kind of CARE_KINDS) {
        const day = dayKey(d);
        const target = dayKey(addDays(d, 7));
        const goer = findSlot(events, kid, day, kind)?.responsible_member_id ?? null;
        const already = slotAvailability(laterAnswers, kid, target, kind);
        // Never overwrite a choice already made.
        const said = slotAvailability(answers, kid, day, kind)
          .filter((a) => a.member_id !== goer)
          .map((a) => ({ member_id: a.member_id, available: a.available }));
        if (goer) said.push({ member_id: goer, available: true });
        let changed = false;
        for (const a of said) {
          if (already.some((b) => b.member_id === a.member_id)) continue;
          if (!(await setAvailability(supabase, kid, target, kind, a.member_id, a.available))) changed = true;
        }
        if (goer && goer === me?.id && !findSlot(laterEvents, kid, target, kind) && !already.some((b) => b.member_id === goer)) {
          if (!(await assignSlot(supabase, kid, target, kind, goer, null))) changed = true;
        }
        if (changed) copied++;
      }
    }
    toast(copied ? t("Copied {n} to next week", { n: copied }) : t("Next week is already planned"));
    setWeekStart(addDays(weekStart, 7));
  }

  const shown = days.filter((d) => isCareDay(kid, d) || CARE_KINDS.some((k) => findSlot(events, kid, dayKey(d), k)));
  const thisWeek = weekKey === dayKey(startOfWeek(new Date()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">{kids.length === 1 ? `${kid.emoji} ${kid.name}` : t("Kids")}</h1>
        <button className="btn-ghost" onClick={() => setSettings(true)}>⚙️ {t("Usual times")}</button>
      </div>

      {kids.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {kids.map((k) => (
            <button key={k.id} onClick={() => setKidId(k.id)} className={`chip-toggle ${k.id === kid.id ? "chip-on" : ""}`}>
              {k.emoji} {k.name}
            </button>
          ))}
        </div>
      )}

      {open > 0 && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
          {open === 1 ? t("1 drop-off or pick-up has nobody yet in the next two weeks.") : t("{n} drop-offs and pick-ups have nobody yet in the next two weeks.", { n: open })}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("Previous week")}>←</button>
        <div className="text-center">
          <div className="font-semibold">{thisWeek ? t("This week") : weekKey === dayKey(addDays(startOfWeek(new Date()), 7)) ? t("Next week") : t("Week of {date}", { date: fmtDate(weekStart, { day: "numeric", month: "short" }) })}</div>
          {!thisWeek && (
            <button className="text-xs text-muted underline" onClick={() => setWeekStart(startOfWeek(new Date()))}>{t("Back to this week")}</button>
          )}
        </div>
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("Next week")}>→</button>
      </div>

      <section className="card flex flex-col gap-1 p-2">
        <div className="grid grid-cols-[3.25rem_1fr_1fr] gap-2 px-1 pb-1 text-xs uppercase tracking-wide text-muted">
          <span />
          <span>☀️ {t("Morning")}</span>
          <span>🌙 {t("Afternoon")}</span>
        </div>
        {shown.map((d) => {
          const k = dayKey(d);
          return (
            <div key={k} className={`grid grid-cols-[3.25rem_1fr_1fr] items-center gap-2 rounded-xl p-1 ${k === todayKey ? "bg-accent-soft" : ""}`}>
              <div className="text-center leading-tight">
                <div className="text-xs uppercase text-muted">{fmtDate(d, { weekday: "short" })}</div>
                <div className="text-lg font-semibold tabular-nums">{d.getDate()}</div>
              </div>
              {CARE_KINDS.map((kind) => (
                <CareSlot
                  key={kind}
                  kid={kid}
                  day={k}
                  kind={kind}
                  event={findSlot(events, kid, k, kind)}
                  availability={slotAvailability(answers, kid, k, kind)}
                  past={k < todayKey}
                  onChanged={load}
                  onEdit={setEditing}
                />
              ))}
            </div>
          );
        })}
        {shown.length === 0 && <p className="p-3 text-sm text-muted">{t("No preschool days this week.")}</p>}
      </section>

      <p className="text-sm text-muted">{t("Tap a slot once if you can, twice if you can't. The one who goes taps “I'm going”. ⋯ changes the time or place.")}</p>
      <button className="btn-ghost py-3" onClick={copyToNextWeek}>{t("Copy this week to next week")}</button>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t("Edit event")}>
        {editing && (
          <EventForm
            initial={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Sheet>

      <Sheet open={settings} onClose={() => setSettings(false)} title={t("Usual times for {name}", { name: kid.name })}>
        {settings && <KidSettings kid={kid} onDone={() => setSettings(false)} />}
      </Sheet>
    </div>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function KidSettings({ kid, onDone }: { kid: Member; onDone: () => void }) {
  const { supabase, t } = useFamily();
  const router = useRouter();
  const [dropoff, setDropoff] = useState(kid.dropoff_time?.slice(0, 5) ?? "08:00");
  const [pickup, setPickup] = useState(kid.pickup_time?.slice(0, 5) ?? "16:00");
  const [place, setPlace] = useState(kid.care_place ?? "");
  const [daysOn, setDaysOn] = useState<number[]>(kid.care_days ?? [1, 2, 3, 4, 5]);
  // Monday 2 Jan 2023 + n: weekday names in the account's language.
  const dayName = (iso: number) => fmtDate(new Date(2023, 0, 1 + iso), { weekday: "short" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase
      .from("members")
      .update({ dropoff_time: dropoff, pickup_time: pickup, care_place: place.trim() || null, care_days: [...daysOn].sort() })
      .eq("id", kid.id);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">☀️ {t("Drop-off")}</span>
          <input className="input" type="time" value={dropoff} onChange={(e) => setDropoff(e.target.value)} required />
        </label>
        <label>
          <span className="label">🌙 {t("Pick-up")}</span>
          <input className="input" type="time" value={pickup} onChange={(e) => setPickup(e.target.value)} required />
        </label>
      </div>
      <label>
        <span className="label">{t("Preschool or school")}</span>
        <input className="input" placeholder={t("e.g. Förskolan Solrosen, Hantverkargatan 3")} value={place} onChange={(e) => setPlace(e.target.value)} />
      </label>
      <div>
        <span className="label">{t("Days")}</span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDaysOn(daysOn.includes(d) ? daysOn.filter((x) => x !== d) : [...daysOn, d])}
              className={`chip-toggle capitalize ${daysOn.includes(d) ? "chip-on" : ""}`}
            >
              {dayName(d)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">{t("New drop-offs and pick-ups use these times. Ones already planned keep theirs.")}</p>
      <button className="btn">{t("Save")}</button>
    </form>
  );
}

