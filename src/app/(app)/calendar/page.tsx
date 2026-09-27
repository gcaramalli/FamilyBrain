"use client";

import { CalendarSegments, PageHeader } from "@/components/page-header";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFamily } from "@/components/family-context";
import { EventForm, newEventDraft } from "@/components/event-form";
import { EventRow } from "@/components/event-row";
import { Sheet } from "@/components/sheet";
import { addDays, dayKey, fmtDate, formatDayHeading, startOfDay } from "@/lib/dates";
import { groupByDay, isMultiDay } from "@/lib/events";
import { fetchCalendar } from "@/lib/occasions";
import { MODULES } from "@/lib/modules";
import type { EventOccurrence, ListItem, Member } from "@/lib/types";
import { MemberBadge } from "@/components/member-select";
import { useToast } from "@/components/toast";
import Link from "next/link";

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
  const people = new Map<string, { m?: Member; title: string; badge?: string }>();
  for (const e of events) {
    // Our anniversary or a birthday shows its emoji instead of an initial.
    const id = e.badge ? `badge:${e.key}` : e.responsible_member_id ?? "none";
    if (!people.has(id)) people.set(id, { m: memberById(e.responsible_member_id), title: e.title, badge: e.badge });
  }
  const list = [...people.values()];
  return (
    <>
      {list.slice(0, max).map(({ m, title, badge }, i) =>
        badge ? (
          <span key={i} title={title} className="flex h-4 w-4 items-center justify-center text-[11px] leading-none">{badge}</span>
        ) : (
          <span
            key={i}
            title={`${title}${m ? ` — ${m.name}` : ""}`}
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold leading-none text-white"
            style={{ background: m?.color ?? "#9ca3af" }}
          >
            {m ? m.name.slice(0, 1) : "?"}
          </span>
        ),
      )}
      {list.length > max && <span className="text-[9px] leading-4 text-muted">+{list.length - max}</span>}
    </>
  );
}

export default function CalendarPage() {
  const { supabase, members, me, t } = useFamily();
  const router = useRouter();
  const [who, setWho] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [focus, setFocus] = useState<string | null>(null);
  const [allEvents, setEvents] = useState<EventOccurrence[]>([]);
  const [allTodos, setTodos] = useState<ListItem[]>([]);
  const toast = useToast();
  const [editing, setEditing] = useState<Parameters<typeof EventForm>[0]["initial"] | null>(null);

  const from = mode === "month" ? startOfMonthGrid(anchor) : mode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
  const span = mode === "month" ? MONTH_CELLS : mode === "week" ? 7 : AGENDA_DAYS;
  const fromKey = dayKey(from);

  const load = useCallback(async () => {
    const start = new Date(fromKey + "T00:00:00");
    const [evs, todos] = await Promise.all([
      fetchCalendar(supabase, members, start, addDays(start, span), t),
      // To-dos with a due date show up on their day, until they are done.
      supabase
        .from("list_items")
        .select("*, lists!inner(kind)")
        .eq("lists.kind", "todo")
        .eq("done", false)
        .gte("due_date", fromKey)
        .lt("due_date", dayKey(addDays(start, span))),
    ]);
    setEvents(evs);
    setTodos((todos.data ?? []) as ListItem[]);
  }, [supabase, members, t, fromKey, span]);

  async function checkTodo(item: ListItem) {
    setTodos((xs) => xs.filter((x) => x.id !== item.id));
    await supabase.from("list_items").update({ done: true, done_at: new Date().toISOString() }).eq("id", item.id);
    toast(t("Done: {item}", { item: item.title }), async () => {
      await supabase.from("list_items").update({ done: false, done_at: null }).eq("id", item.id);
      load();
    });
  }

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

  // Filter: only what one person does or what is about them.
  const events = useMemo(
    () => (who ? allEvents.filter((e) => e.badge || e.responsible_member_id === who || e.for_member_id === who) : allEvents),
    [allEvents, who],
  );

  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(new Date(fromKey + "T00:00:00"), i)), [fromKey, span]);
  const byDay = useMemo(() => groupByDay(events), [events]);
  const todosByDay = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const i of allTodos) {
      if (!i.due_date || (who && i.assignee_member_id !== who)) continue;
      map.set(i.due_date, [...(map.get(i.due_date) ?? []), i]);
    }
    return map;
  }, [allTodos, who]);

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
      ? fmtDate(anchor, { month: "long", year: "numeric" })
      : mode === "week"
        ? t("Week of {date}", { date: fmtDate(days[0], { day: "numeric", month: "short" }) })
        : t("From {date}", { date: fmtDate(days[0], { day: "numeric", month: "short" }) });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Calendar")}
        module="calendar"
        action={<button className="btn" onClick={() => setEditing(newEventDraft(focus ? new Date(focus + "T00:00:00") : undefined, me))}>+ {t("Event")}</button>}
      >
        <CalendarSegments />
      </PageHeader>

      {/* How to look at it: chips, lighter than the section switch above. */}
      <div className="flex gap-2">
        {(["month", "week", "agenda"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setFocus(null);
              setMode(m);
            }}
            className={`chip-toggle ${mode === m ? "chip-on" : ""}`}
          >
            {m === "month" ? t("Month") : m === "week" ? t("Week") : t("Agenda")}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost w-11 shrink-0" onClick={() => shift(-1)} aria-label={t("Previous")}>←</button>
        <div className="min-w-0 text-center">
          <div className="truncate font-semibold first-letter:uppercase">{periodLabel}</div>
          <button
            className="text-xs text-muted underline underline-offset-2"
            onClick={() => {
              setFocus(null);
              setAnchor(new Date());
            }}
          >
            {t("Today")}
          </button>
        </div>
        <button className="btn-ghost w-11 shrink-0" onClick={() => shift(1)} aria-label={t("Next")}>→</button>
      </div>

      {members.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm">
          <button onClick={() => setWho(null)} className={`chip-toggle ${who === null ? "chip-on" : ""}`}>{t("Everyone")}</button>
          {members.map((m) => (
            <button key={m.id} onClick={() => setWho(who === m.id ? null : m.id)} className={`chip-toggle ${who === m.id ? "chip-on" : ""}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {mode === "month" && (
        <section className="card p-2">
          <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted">
            {days.slice(0, 7).map((d) => (
              <div key={dayKey(d)} className="pb-1">{fmtDate(d, { weekday: "narrow" })}</div>
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
                  aria-label={`${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}, ${list.length === 1 ? t("1 event") : t("{n} events", { n: list.length })}`}
                  className={`flex min-h-16 flex-col items-center gap-1 border-b border-r border-border px-0.5 py-1 active:bg-accent-soft ${inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${k === todayKey ? "bg-accent font-semibold text-on-accent" : ""}`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    <Initials events={list} max={3} />
                    {todosByDay.has(k) && <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: MODULES.todo.color }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-1 pt-2 text-xs text-muted">{t("Tap a day to open its week.")}</p>
        </section>
      )}

      {mode === "week" && (
        <section className="card p-3">
          <div className="mb-2 text-sm text-muted first-letter:uppercase">{t("drop-offs, pick-ups & trips")}</div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((d) => {
              const k = dayKey(d);
              const shown = (byDay.get(k) ?? []).filter((e) => e.care || DUTY.test(e.title) || e.all_day || isMultiDay(e));
              return (
                <button
                  key={k}
                  onClick={() => setFocus(k)}
                  className={`rounded-lg py-1.5 ${k === todayKey ? "bg-accent-soft" : ""} ${k === focus ? "ring-1 ring-accent" : ""}`}
                >
                  <div className="text-[11px] uppercase text-muted">{fmtDate(d, { weekday: "narrow" })}</div>
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
            const todos = todosByDay.get(k) ?? [];
            if (mode === "week" && list.length === 0 && todos.length === 0 && k !== focus) return null;
            return (
              <section key={k} id={`day-${k}`} className={`card scroll-mt-20 py-3 ${k === focus ? "border-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold capitalize">{formatDayHeading(day)}</h2>
                  <button className="min-h-9 px-1 text-sm font-medium text-accent" onClick={() => setEditing(newEventDraft(day, me))}>+ {t("Add")}</button>
                </div>
                {todos.length > 0 && (
                  <ul className="mt-1 flex flex-col">
                    {todos.map((i) => (
                      <li key={i.id} className="flex min-h-11 items-center gap-3">
                        <button onClick={() => checkTodo(i)} aria-label={t("Mark as done")} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
                          <span className="h-5 w-5 rounded-md border-[1.5px]" style={{ borderColor: MODULES.todo.color }} />
                        </button>
                        <Link href="/todo" className="min-w-0 flex-1 truncate">{i.title}</Link>
                        <MemberBadge id={i.assignee_member_id} />
                      </li>
                    ))}
                  </ul>
                )}
                {list.length === 0 ? (
                  todos.length === 0 && <p className="py-1 text-sm text-muted">{t("Nothing planned")}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {list.map((ev) => (
                      <EventRow key={ev.key} ev={ev} day={k} onClick={() => (ev.link ? router.push(ev.link) : setEditing(ev))} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {mode === "week" && events.length === 0 && todosByDay.size === 0 && !focus && <p className="card text-sm text-muted">{t("Nothing planned this week.")}</p>}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("Edit event") : t("New event")}>
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
