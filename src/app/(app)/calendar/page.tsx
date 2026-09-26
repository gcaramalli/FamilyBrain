"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { EventForm, newEventDraft } from "@/components/event-form";
import { EventRow } from "@/components/event-row";
import { Sheet } from "@/components/sheet";
import { addDays, dayKey, formatDayHeading, startOfDay } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";

const DAYS = 14;

export default function CalendarPage() {
  const { supabase } = useFamily();
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editing, setEditing] = useState<Parameters<typeof EventForm>[0]["initial"] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", addDays(from, DAYS).toISOString())
      .order("starts_at");
    setEvents((data ?? []) as CalendarEvent[]);
  }, [supabase, from]);

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

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const k = dayKey(ev.starts_at);
      map.set(k, [...(map.get(k) ?? []), ev]);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Calendar</h1>
        <button className="btn" onClick={() => setEditing(newEventDraft())}>+ Event</button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button className="btn-ghost" onClick={() => setFrom(addDays(from, -DAYS))}>← Earlier</button>
        <button className="text-accent" onClick={() => setFrom(startOfDay(new Date()))}>Today</button>
        <button className="btn-ghost" onClick={() => setFrom(addDays(from, DAYS))}>Later →</button>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((day) => {
          const list = byDay.get(dayKey(day)) ?? [];
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
                    <EventRow key={ev.id} ev={ev} onClick={() => setEditing(ev)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
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
