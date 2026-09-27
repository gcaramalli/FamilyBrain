"use client";

import { Moon, Sparkles, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { useKid } from "@/components/kid-context";
import { PageHeader } from "@/components/page-header";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { addDays, dayKey, fmtDate, formatTime, startOfDay, toLocalInput } from "@/lib/dates";
import { avgClock, fmtDuration, minutesBetween, nightDay, sleepDays, sleepState } from "@/lib/sleep";
import type { KidSleep } from "@/lib/types";

const DAYS = 14;
type Draft = Pick<KidSleep, "kind" | "starts_at" | "ends_at" | "wakings" | "notes"> & { id?: string };

const localDay = (iso: string) => dayKey(new Date(iso));
const minutesOfDay = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

// Naps and nights, logged in one tap ("asleep" / "awake"), so Claude can
// look at the last days and suggest tonight's bedtime.
export default function SleepPage() {
  const { supabase, t } = useFamily();
  const { kid } = useKid();
  const toast = useToast();
  const [entries, setEntries] = useState<KidSleep[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [, tick] = useState(0);
  const kidId = kid?.id;

  const load = useCallback(async () => {
    if (!kidId) return;
    const since = addDays(startOfDay(new Date()), -DAYS).toISOString();
    const { data } = await supabase.from("kid_sleep").select("*").eq("kid_id", kidId).gte("starts_at", since).order("starts_at", { ascending: false });
    setEntries((data ?? []) as KidSleep[]);
  }, [supabase, kidId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("kid-sleep")
      .on("postgres_changes", { event: "*", schema: "public", table: "kid_sleep" }, load)
      .subscribe();
    // "Asleep for 1 h 20" keeps counting.
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [supabase, load]);

  const days = useMemo(() => sleepDays(entries, localDay), [entries]);

  if (!kid) return null;

  const state = sleepState(entries);
  const current = state?.asleep ? entries.find((e) => !e.ends_at) : undefined;
  const week = days.filter((d) => d.day >= dayKey(addDays(new Date(), -7)) && d.day < dayKey(new Date()));
  const nights = week.map((d) => d.night).filter((n) => n !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const avgTotal = avg(week.map((d) => d.night_minutes + d.nap_minutes));
  const avgBed = avgClock(nights.map((n) => n.start), minutesOfDay, true);
  const avgWake = avgClock(nights.map((n) => n.end).filter((e) => e !== null), minutesOfDay);

  // Evening: bedtime; otherwise a nap.
  const likelyKind = () => (new Date().getHours() >= 17 || new Date().getHours() < 5 ? "night" : "nap");

  async function fallAsleep(kind: "nap" | "night") {
    if (!kid) return;
    await supabase.from("kid_sleep").insert({ kid_id: kid.id, kind, starts_at: new Date().toISOString() });
    load();
  }

  async function wakeUp() {
    if (!current) return;
    await supabase.from("kid_sleep").update({ ends_at: new Date().toISOString() }).eq("id", current.id);
    load();
    toast(t("Woke up · slept {duration}", { duration: fmtDuration(minutesBetween(current.starts_at, new Date())) }), async () => {
      await supabase.from("kid_sleep").update({ ends_at: null }).eq("id", current.id);
      load();
    });
  }

  async function addWaking() {
    if (!current) return;
    await supabase.from("kid_sleep").update({ wakings: current.wakings + 1 }).eq("id", current.id);
    load();
    toast(t("Waking noted"), async () => {
      await supabase.from("kid_sleep").update({ wakings: current.wakings }).eq("id", current.id);
      load();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Sleep")}
        module="sleep"
        back="/kids"
        backLabel={`${kid.emoji} ${kid.name}`}
        action={
          <button className="btn" onClick={() => setEditing({ kind: likelyKind(), starts_at: new Date(Date.now() - 3600000).toISOString(), ends_at: new Date().toISOString(), wakings: 0, notes: null })}>
            + {t("Log")}
          </button>
        }
      />

      <section className="card flex flex-col gap-3">
        {state?.asleep && current ? (
          <>
            <p className="text-lg font-semibold">
              {current.kind === "night" ? "🌙" : "😴"} {t("Asleep since {time}", { time: formatTime(current.starts_at) })}
              <span className="font-normal text-muted"> · {fmtDuration(minutesBetween(current.starts_at, new Date()))}</span>
            </p>
            {current.kind === "night" && current.wakings > 0 && (
              <p className="text-sm text-muted">{current.wakings === 1 ? t("1 waking so far") : t("{n} wakings so far", { n: current.wakings })}</p>
            )}
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={wakeUp}><Sun size={18} /> {t("Woke up")}</button>
              {current.kind === "night" && <button className="btn-ghost" onClick={addWaking}>+1 {t("waking")}</button>}
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {state ? (
                <>
                  {t("Awake since {time}", { time: formatTime(state.since) })}
                  <span className="font-normal text-muted"> · {fmtDuration(minutesBetween(state.since, new Date()))}</span>
                </>
              ) : (
                t("Tap when {name} falls asleep.", { name: kid.name })
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className={likelyKind() === "nap" ? "btn" : "btn-ghost"} onClick={() => fallAsleep("nap")}>😴 {t("Nap")}</button>
              <button className={likelyKind() === "night" ? "btn" : "btn-ghost"} onClick={() => fallAsleep("night")}><Moon size={18} /> {t("Night")}</button>
            </div>
          </>
        )}
      </section>

      {week.length > 0 && (
        <section className="card flex flex-col gap-1">
          <h2 className="font-semibold">{t("Last 7 days")}</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t("Sleep per day")} value={avgTotal !== null ? fmtDuration(avgTotal) : "–"} />
            <Stat label={t("Bedtime")} value={avgBed ?? "–"} />
            <Stat label={t("Wake-up")} value={avgWake ?? "–"} />
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        <Sparkles size={16} className="mt-0.5 shrink-0" />
        <span>{t("Ask Claude “when should {name} go to bed tonight?”: it reads the last days here.", { name: kid.name })}</span>
      </p>

      {days.map((d) => (
        <section key={d.day}>
          <h3 className="flex items-baseline justify-between text-sm font-medium text-muted">
            <span className="capitalize">{fmtDate(new Date(d.day + "T12:00:00"), { weekday: "long", day: "numeric", month: "short" })}</span>
            <span className="tabular-nums">{fmtDuration(d.night_minutes + d.nap_minutes)}</span>
          </h3>
          <ul className="divide-y divide-border">
            {entries
              .filter((e) => (e.kind === "night" ? nightDay(e.starts_at, localDay) : localDay(e.starts_at)) === d.day)
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .map((e) => (
                <li key={e.id}>
                  <button className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(e)}>
                    <span className="text-xl">{e.kind === "night" ? "🌙" : "😴"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium tabular-nums">
                        {formatTime(e.starts_at)} → {e.ends_at ? formatTime(e.ends_at) : "…"}
                      </span>
                      <span className="block text-sm text-muted">
                        {fmtDuration(minutesBetween(e.starts_at, e.ends_at ?? new Date()))}
                        {e.wakings > 0 && ` · ${e.wakings === 1 ? t("1 waking") : t("{n} wakings", { n: e.wakings })}`}
                        {e.notes && ` · ${e.notes}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("Edit") : t("Log sleep")}>
        {editing && (
          <SleepForm
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-accent-soft px-2 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function SleepForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const { supabase, t } = useFamily();
  const { kid } = useKid();
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!kid) return;
    if (d.ends_at && d.ends_at <= d.starts_at) return setError(t("The end must be after the start."));
    const fields = { kind: d.kind, starts_at: d.starts_at, ends_at: d.ends_at, wakings: d.wakings, notes: d.notes?.trim() || null };
    const { error } = d.id
      ? await supabase.from("kid_sleep").update(fields).eq("id", d.id)
      : await supabase.from("kid_sleep").insert({ ...fields, kid_id: kid.id });
    if (error) setError(error.message);
    else onDone();
  }

  async function remove() {
    if (!d.id) return;
    const { data: before } = await supabase.from("kid_sleep").select("*").eq("id", d.id).single();
    await supabase.from("kid_sleep").delete().eq("id", d.id);
    onDone();
    toast(t("Deleted"), async () => {
      if (before) await supabase.from("kid_sleep").insert(before);
      onDone();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-full bg-accent-soft p-1 text-sm">
        {(["nap", "night"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => set("kind", k)}
            className={`min-h-9 rounded-full ${d.kind === k ? "bg-[var(--pill)] font-semibold shadow-sm" : "text-muted"}`}
          >
            {k === "nap" ? `😴 ${t("Nap")}` : `🌙 ${t("Night")}`}
          </button>
        ))}
      </div>
      <label>
        <span className="label">{t("Fell asleep")}</span>
        <input className="input" type="datetime-local" required value={toLocalInput(d.starts_at)} onChange={(e) => e.target.value && set("starts_at", new Date(e.target.value).toISOString())} />
      </label>
      <label>
        <span className="label">{t("Woke up")}</span>
        <input className="input" type="datetime-local" value={d.ends_at ? toLocalInput(d.ends_at) : ""} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
        <span className="mt-1 block text-xs text-muted">{t("Leave empty if still asleep.")}</span>
      </label>
      {d.kind === "night" && (
        <label>
          <span className="label">{t("Night wakings")}</span>
          <input className="input" type="number" min={0} max={30} value={d.wakings} onChange={(e) => set("wakings", Math.max(0, Math.min(30, Number(e.target.value) || 0)))} />
        </label>
      )}
      <input className="input" placeholder={t("Note (optional): teething, fever, long waking at 3…")} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn flex-1">{t("Save")}</button>
        {d.id && <button type="button" className="btn-ghost text-danger" onClick={remove}>{t("Delete")}</button>}
      </div>
    </form>
  );
}
