"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "./family-context";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { fmtDate } from "@/lib/dates";
import type { T } from "@/lib/i18n";
import { daysAway, fetchOccasions, nextAnniversary, OCCASION_EMOJI, occasionLabel, parseOccasionList, upcoming } from "@/lib/occasions";
import type { Occasion } from "@/lib/types";

type Draft = Omit<Occasion, "id"> & { id?: string };

export function whenLabel(t: T, days: number, day: Date) {
  if (days === 0) return t("today");
  if (days === 1) return t("tomorrow");
  return t("in {n} days · {date}", { n: days, date: fmtDate(day, { weekday: "short", day: "numeric", month: "short" }) });
}

// Weddings and birthdays of the people around us. Kept out of the calendar
// (only "ours" shows there); reminders arrive the evening before.
export function OccasionsPanel() {
  const { supabase, adults, memberById, t } = useFamily();
  const toast = useToast();
  const [items, setItems] = useState<Occasion[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pasting, setPasting] = useState(false);

  const load = useCallback(async () => setItems(await fetchOccasions(supabase)), [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const soon = useMemo(() => upcoming(items, 60), [items]);
  // All of them, grouped by the year it happened.
  const byYear = useMemo(() => {
    const map = new Map<string, Occasion[]>();
    for (const o of items) map.set(o.date.slice(0, 4), [...(map.get(o.date.slice(0, 4)) ?? []), o]);
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  const who = (o: Occasion) =>
    o.member_ids.length === 1 && adults.length > 1 ? t("just {name}", { name: memberById(o.member_ids[0])?.name ?? "?" }) : null;

  async function remove(o: Draft & { id: string }) {
    const before = items.find((x) => x.id === o.id);
    await supabase.from("occasions").delete().eq("id", o.id);
    setEditing(null);
    load();
    toast(t("Deleted"), async () => {
      if (before) await supabase.from("occasions").insert(before);
      load();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setEditing({ kind: "wedding", title: "", date: "", ours: false, member_ids: adults.map((a) => a.id), ended: false, notes: null })}>
          + {t("Date")}
        </button>
        <button className="btn-ghost" onClick={() => setPasting(true)}>📋 {t("Paste a list")}</button>
      </div>
      <p className="text-sm text-muted">{t("Weddings and birthdays of the people around you. They stay out of the calendar; you get a reminder the evening before. Only your own dates appear in the calendar.")}</p>

      <section>
        <h2 className="h2">{t("Coming up")}</h2>
        {soon.length === 0 ? (
          <p className="py-2 text-sm text-muted">{t("Nothing in the next two months.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {soon.map(({ o, day, years }) => (
              <li key={o.id}>
                <button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setEditing(o)}>
                  <span className="text-xl">{OCCASION_EMOJI[o.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.title}{o.ours && " ⭐"}</span>
                    <span className="block text-sm text-muted">
                      {occasionLabel(t, o.kind, years)} · {whenLabel(t, daysAway(day), day)}
                      {who(o) && ` · ${who(o)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {byYear.map(([year, list]) => (
        <section key={year}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{year}</h3>
          <ul className="divide-y divide-border">
            {list.map((o) => {
              const { years } = nextAnniversary(o.date);
              return (
                <li key={o.id}>
                  <button className={`flex w-full items-baseline gap-3 py-2 text-left ${o.ended ? "text-muted" : ""}`} onClick={() => setEditing(o)}>
                    <span className="w-14 shrink-0 text-sm tabular-nums text-muted">{fmtDate(o.date + "T12:00:00", { day: "numeric", month: "short" })}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        {OCCASION_EMOJI[o.kind]} {o.title}
                        {o.ours && " ⭐"}
                      </span>
                      <span className="block text-xs text-muted">
                        {o.ended ? t("no longer celebrated") : years > 0 ? occasionLabel(t, o.kind, years) : ""}
                        {who(o) && ` · ${who(o)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("Edit date") : t("New date")}>
        {editing && (
          <OccasionForm
            initial={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onDelete={editing.id ? () => remove(editing as Draft & { id: string }) : undefined}
          />
        )}
      </Sheet>

      <Sheet open={pasting} onClose={() => setPasting(false)} title={t("Paste a list")}>
        {pasting && (
          <PasteList
            onDone={(n) => {
              setPasting(false);
              load();
              toast(t("{n} dates added", { n }));
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function OccasionForm({ initial, onDone, onDelete }: { initial: Draft; onDone: () => void; onDelete?: () => void }) {
  const { supabase, adults, t } = useFamily();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fields = { kind: d.kind, title: d.title.trim(), date: d.date, ours: d.ours, member_ids: d.member_ids, ended: d.ended, notes: d.notes?.trim() || null };
    const { error } = d.id ? await supabase.from("occasions").update(fields).eq("id", d.id) : await supabase.from("occasions").insert(fields);
    if (error) return setError(error.message);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(["wedding", "birthday", "other"] as const).map((k) => (
          <button type="button" key={k} onClick={() => set("kind", k)} className={`chip-toggle justify-center ${d.kind === k ? "chip-on" : ""}`}>
            {OCCASION_EMOJI[k]} {k === "wedding" ? t("Wedding") : k === "birthday" ? t("Birthday") : t("Other")}
          </button>
        ))}
      </div>
      <input className="input" placeholder={t("Who? e.g. Damien & Caroline")} required value={d.title} onChange={(e) => set("title", e.target.value)} />
      <label>
        <span className="label">{d.kind === "birthday" ? t("Date of birth") : t("Date")}</span>
        <input className="input" type="date" required value={d.date} onChange={(e) => set("date", e.target.value)} />
      </label>
      {adults.length > 1 && (
        <div>
          <span className="label">{t("Who is it for / who was there")}</span>
          <div className="flex flex-wrap gap-2">
            {adults.map((a) => {
              const on = d.member_ids.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => set("member_ids", on ? d.member_ids.filter((x) => x !== a.id) : [...d.member_ids, a.id])}
                  className={`chip-toggle ${on ? "chip-on" : ""}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                  {a.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">{t("Reminders go to these people.")}</p>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.ours} onChange={(e) => set("ours", e.target.checked)} /> ⭐ {t("One of ours: show it in the calendar")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.ended} onChange={(e) => set("ended", e.target.checked)} /> {t("No longer celebrated (keep it, no reminders)")}
      </label>
      <textarea className="input min-h-20" placeholder={t("Notes: what we gave, a memory, gift ideas…")} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn flex-1">{t("Save")}</button>
        {onDelete && <button type="button" className="btn-ghost text-danger" onClick={onDelete}>{t("Delete")}</button>}
      </div>
    </form>
  );
}

function PasteList({ onDone }: { onDone: (n: number) => void }) {
  const { supabase, adults, me, t } = useFamily();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Occasion["kind"]>("wedding");
  const [error, setError] = useState<string | null>(null);
  const { ok, bad } = useMemo(() => parseOccasionList(text), [text]);

  async function add() {
    const rows = ok.map((p) => ({
      kind,
      title: p.title,
      date: p.date,
      ended: p.ended,
      // "*" = only me.
      member_ids: p.alone && me ? [me.id] : adults.map((a) => a.id),
    }));
    const { error } = await supabase.from("occasions").insert(rows);
    if (error) return setError(error.message);
    onDone(rows.length);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(["wedding", "birthday", "other"] as const).map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)} className={`chip-toggle justify-center ${kind === k ? "chip-on" : ""}`}>
            {OCCASION_EMOJI[k]} {k === "wedding" ? t("Wedding") : k === "birthday" ? t("Birthday") : t("Other")}
          </button>
        ))}
      </div>
      <textarea
        className="input min-h-48 font-mono text-sm"
        placeholder={"251025 Damien & Caroline\n2021-05-15 Baptiste & Lovisa\n12/03/2022 Hugo *\n190803 Michael & Pauline //"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-xs text-muted">{t("One per line: date then names. Dates as 251025, 2025-10-25 or 25/10/2025. Add * if only you were there, // if it's no longer celebrated.")}</p>
      {text.trim() && (
        <p className="text-sm">
          {t("{n} dates recognised", { n: ok.length })}
          {bad.length > 0 && <span className="text-danger"> · {t("{n} lines not understood", { n: bad.length })}: {bad.slice(0, 3).join(" · ")}</span>}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn" disabled={!ok.length} onClick={add}>{t("Add {n} dates", { n: ok.length })}</button>
    </div>
  );
}
