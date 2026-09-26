"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { EventForm, newEventDraft } from "@/components/event-form";
import { EventRow } from "@/components/event-row";
import { Sheet } from "@/components/sheet";
import { addDays, dayKey, formatDayHeading, startOfDay } from "@/lib/dates";
import { fetchOccurrences, groupByDay, isMultiDay } from "@/lib/events";
import type { EventOccurrence, Member } from "@/lib/types";

type Mode = "month" | "week" | "agenda";
const AGENDA_DAYS = 14;
const MONTH_CELLS = 42; // 6 weeks, like Apple Calendar

// Drop-offs and pick-ups get their own row in the week view.
const DUTY = /(pick|drop|hämt|lämn|récup|dépos|förskola|preschool|daycare|kindergarten|school|skola)/i;

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -dow);
}

function startOfMonthGrid(d: Date) {
  return startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
}

// One initial per person (and one grey "?" for events nobody is responsible for).
function Initials({ events, max }: { events: EventOccurrence[]; max: number }) {
  const { memberById } = useFamily();
  const people = new Map<string, { m?: Member; title: string }>();
  for (const e of events) {
    const id = e.responsible_member_id ?? "none";
    if (!people.has(id)) people.set(id, { m: memberById(e.responsible_member_id), title: e.title });
  }
  const list = [...people.values()];
  return (
    <>
      {list.slice(0, max).map(({ m, title }, i) => (
        <span
          key={i}
          title={`${title}${m ? ` — ${m.name}` : ""}`}
          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold leading-none text-white"
          style={{ background: m?.color ?? "#9ca3af" }}
        >
          {m ? m.name.slice(0, 1) : "?"}
        </span>
      ))}
      {list.length > max && <span className="text-[9px] leading-4 text-muted">+{list.length - max}</span>}
    </>
  );
}

export default function CalendarPage() {
  const { supabase } = useFamily();
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [focus, setFocus] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [editing, setEditing] = useState<Parameters<typeof EventForm>[0]["initial"] | null>(null);

  const from = mode === "month" ? startOfMonthGrid(anchor) : mode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
  const span = mode === "month" ? MONTH_CELLS : mode === "week" ? 7 : AGENDA_DAYS;
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
  const byDay = useMemo(() => groupByDay(events), [events]);

  // Coming from the month view: bring the tapped day into view.
  useEffect(() => {
    if (mode === "week" && focus) document.getElementById(`day-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mode, focus, events]);

  const todayKey = dayKey(new Date());
  const shift = (n: number) => {
    setFocus(null);
    setAnchor(mode === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1) : addDays(anchor, n * span));
  };
  const openWeek = (d: Date) => {
    setAnchor(d);
    setFocus(dayKey(d));
    setMode("week");
  };
  const periodLabel =
    mode === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : mode === "week"
        ? `Week of ${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
        : `From ${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Calendar</h1>
        <button className="btn" onClick={() => setEditing(newEventDraft(focus ? new Date(focus + "T00:00:00") : undefined))}>+ Event</button>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex rounded-xl border border-border p-0.5">
          {(["month", "week", "agenda"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setFocus(null);
                setMode(m);
              }}
              className={`rounded-lg px-3 py-1 capitalize ${mode === m ? "bg-accent text-white" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Previous">←</button>
          <button
            className="text-accent"
            onClick={() => {
              setFocus(null);
              setAnchor(new Date());
            }}
          >
            Today
          </button>
          <button className="btn-ghost" onClick={() => shift(1)} aria-label="Next">→</button>
        </div>
      </div>

      {mode === "month" && (
        <section className="card p-2">
          <h2 className="px-1 pb-2 font-semibold capitalize">{periodLabel}</h2>
          <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted">
            {days.slice(0, 7).map((d) => (
              <div key={dayKey(d)} className="pb-1">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-border">
            {days.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === anchor.getMonth();
              const list = byDay.get(k) ?? [];
              return (
                <button
                  key={k}
                  onClick={() => openWeek(d)}
                  aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${list.length} event${list.length === 1 ? "" : "s"}`}
                  className={`flex min-h-16 flex-col items-center gap-1 border-b border-r border-border px-0.5 py-1 active:bg-accent-soft ${inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${k === todayKey ? "bg-accent font-semibold text-white" : ""}`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    <Initials events={list} max={3} />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-1 pt-2 text-xs text-muted">Tap a day to open its week.</p>
        </section>
      )}

      {mode === "week" && (
        <section className="card p-3">
          <div className="mb-2 text-sm text-muted">{periodLabel} · drop-offs, pick-ups & trips</div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((d) => {
              const k = dayKey(d);
              const shown = (byDay.get(k) ?? []).filter((e) => DUTY.test(e.title) || e.all_day || isMultiDay(e));
              return (
                <button
                  key={k}
                  onClick={() => setFocus(k)}
                  className={`rounded-lg py-1.5 ${k === todayKey ? "bg-accent-soft" : ""} ${k === focus ? "ring-1 ring-accent" : ""}`}
                >
                  <div className="text-[11px] uppercase text-muted">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</div>
                  <div className={`text-sm font-semibold ${k === todayKey ? "text-accent" : ""}`}>{d.getDate()}</div>
                  <div className="mt-1 flex min-h-5 flex-col items-center gap-0.5">
                    <Initials events={shown} max={3} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {mode !== "month" && (
        <div className="flex flex-col gap-3">
          {days.map((day) => {
            const k = dayKey(day);
            const list = byDay.get(k) ?? [];
            if (mode === "week" && list.length === 0 && k !== focus) return null;
            return (
              <section key={k} id={`day-${k}`} className={`card scroll-mt-20 py-3 ${k === focus ? "border-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold capitalize">{formatDayHeading(day)}</h2>
                  <button className="text-sm text-accent" onClick={() => setEditing(newEventDraft(day))}>+ Add</button>
                </div>
                {list.length === 0 ? (
                  <p className="py-1 text-sm text-muted">Nothing planned</p>
                ) : (
                  <div className="divide-y divide-border">
                    {list.map((ev) => (
                      <EventRow key={ev.key} ev={ev} day={k} onClick={() => setEditing(ev)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {mode === "week" && events.length === 0 && !focus && <p className="card text-sm text-muted">Nothing planned this week.</p>}
        </div>
      )}

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
