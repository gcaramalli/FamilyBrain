"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { EventForm, newEventDraft } from "@/components/event-form";
import { EventRow } from "@/components/event-row";
import { Sheet } from "@/components/sheet";
import { addDays, dayKey, formatDayHeading, startOfDay } from "@/lib/dates";
import { fetchOccurrences } from "@/lib/events";
import type { EventOccurrence } from "@/lib/types";

type Mode = "week" | "agenda";
const AGENDA_DAYS = 14;

// Drop-offs and pick-ups get their own row in the week view.
const DUTY = /(pick|drop|hämt|lämn|récup|dépos|förskola|preschool|daycare|kindergarten|school|skola)/i;

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -dow);
}

export default function CalendarPage() {
  const { supabase, memberById } = useFamily();
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [editing, setEditing] = useState<Parameters<typeof EventForm>[0]["initial"] | null>(null);

  const from = mode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
  const span = mode === "week" ? 7 : AGENDA_DAYS;
  const fromKey = dayKey(from);

  const load = useCallback(async () => {
    const start = new Date(fromKey + "T00:00:00");
    setEvents(await fetchOccurrences(supabase, start, addDays(start, span)));
  }, [supabase, fromKey, span]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(new Date(fromKey + "T00:00:00"), i)), [fromKey, span]);
  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const ev of events) {
      const k = dayKey(ev.occurrence_start);
      map.set(k, [...(map.get(k) ?? []), ev]);
    }
    return map;
  }, [events]);

  const todayKey = dayKey(new Date());
  const shift = (n: number) => setAnchor(addDays(anchor, n * span));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Calendar</h1>
        <button className="btn" onClick={() => setEditing(newEventDraft())}>+ Event</button>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex rounded-xl border border-border p-0.5">
          {(["week", "agenda"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1 capitalize ${mode === m ? "bg-accent text-white" : ""}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Previous">←</button>
          <button className="text-accent" onClick={() => setAnchor(new Date())}>Today</button>
          <button className="btn-ghost" onClick={() => shift(1)} aria-label="Next">→</button>
        </div>
      </div>

      {mode === "week" && (
        <section className="card p-3">
          <div className="mb-2 text-sm text-muted">
            Week of {days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} · drop-offs & pick-ups
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((d) => {
              const k = dayKey(d);
              const duty = (byDay.get(k) ?? []).filter((e) => DUTY.test(e.title));
              return (
                <div key={k} className={`rounded-lg py-1.5 ${k === todayKey ? "bg-accent-soft" : ""}`}>
                  <div className="text-[11px] uppercase text-muted">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</div>
                  <div className={`text-sm font-semibold ${k === todayKey ? "text-accent" : ""}`}>{d.getDate()}</div>
                  <div className="mt-1 flex min-h-5 flex-col items-center gap-0.5">
                    {duty.map((e) => {
                      const m = memberById(e.responsible_member_id);
                      return (
                        <span
                          key={e.key}
                          title={`${e.title}${m ? ` — ${m.name}` : ""}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: m?.color ?? "#9ca3af" }}
                        >
                          {m ? m.name.slice(0, 1) : "?"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {days.map((day) => {
          const list = byDay.get(dayKey(day)) ?? [];
          if (mode === "week" && list.length === 0) return null;
          return (
            <section key={dayKey(day)} className="card py-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold capitalize">{formatDayHeading(day)}</h2>
                <button className="text-sm text-accent" onClick={() => setEditing(newEventDraft(day))}>+ Add</button>
              </div>
              {list.length === 0 ? (
                <p className="py-1 text-sm text-muted">Nothing planned</p>
              ) : (
                <div className="divide-y divide-border">
                  {list.map((ev) => (
                    <EventRow key={ev.key} ev={ev} onClick={() => setEditing(ev)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {mode === "week" && events.length === 0 && <p className="card text-sm text-muted">Nothing planned this week.</p>}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit event" : "New event"}>
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
    </div>
  );
}
