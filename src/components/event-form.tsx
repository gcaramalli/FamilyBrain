"use client";

import { useState } from "react";
import { useFamily } from "./family-context";
import { MemberSelect } from "./member-select";
import { toLocalInput } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";

type Draft = Omit<CalendarEvent, "id"> & { id?: string };

export function newEventDraft(day?: Date): Draft {
  const start = day ? new Date(day) : new Date();
  if (day) {
    start.setHours(9, 0, 0, 0);
  } else {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
  }
  return {
    title: "",
    starts_at: start.toISOString(),
    ends_at: null,
    all_day: false,
    location: null,
    notes: null,
    responsible_member_id: null,
    for_member_id: null,
  };
}

export function EventForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const { supabase } = useFamily();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { id } = d;
    const fields = {
      title: d.title,
      starts_at: d.starts_at,
      ends_at: d.ends_at,
      all_day: d.all_day,
      location: d.location,
      notes: d.notes,
      responsible_member_id: d.responsible_member_id,
      for_member_id: d.for_member_id,
    };
    const { error } = id
      ? await supabase.from("events").update(fields).eq("id", id)
      : await supabase.from("events").insert(fields);
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  async function remove() {
    if (!d.id || !confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", d.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <input className="input" placeholder="What? e.g. Preschool pick-up" required value={d.title} onChange={(e) => set("title", e.target.value)} autoFocus />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.all_day} onChange={(e) => set("all_day", e.target.checked)} /> All day
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Starts</span>
          <input
            className="input"
            type={d.all_day ? "date" : "datetime-local"}
            required
            value={d.all_day ? toLocalInput(d.starts_at).slice(0, 10) : toLocalInput(d.starts_at)}
            onChange={(e) => e.target.value && set("starts_at", new Date(d.all_day ? e.target.value + "T00:00" : e.target.value).toISOString())}
          />
        </div>
        <div>
          <span className="label">Ends (optional)</span>
          <input
            className="input"
            type={d.all_day ? "date" : "datetime-local"}
            value={d.ends_at ? (d.all_day ? toLocalInput(d.ends_at).slice(0, 10) : toLocalInput(d.ends_at)) : ""}
            onChange={(e) => set("ends_at", e.target.value ? new Date(d.all_day ? e.target.value + "T23:59" : e.target.value).toISOString() : null)}
          />
        </div>
      </div>
      <input className="input" placeholder="Where?" value={d.location ?? ""} onChange={(e) => set("location", e.target.value || null)} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Who&apos;s responsible</span>
          <MemberSelect value={d.responsible_member_id} onChange={(v) => set("responsible_member_id", v)} />
        </div>
        <div>
          <span className="label">For whom</span>
          <MemberSelect value={d.for_member_id} onChange={(v) => set("for_member_id", v)} placeholder="Everyone" />
        </div>
      </div>
      <textarea className="input min-h-20" placeholder="Notes" value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn flex-1" disabled={busy}>{d.id ? "Save" : "Add to calendar"}</button>
        {d.id && <button type="button" className="btn-ghost text-danger" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}
