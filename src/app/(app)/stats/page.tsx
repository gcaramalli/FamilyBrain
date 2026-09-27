"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { PageHeader } from "@/components/page-header";
import { fmtDate, fmtDateTime } from "@/lib/dates";

// Level 3 (super admin): usage across every family on Hembrain. Only counts
// and dates come back from hembrain_stats() (0010_super_admins.sql), never a
// family's events, lists or notes.

type FamilyStats = {
  id: string;
  name: string;
  created_at: string;
  accounts: number;
  without_account: number;
  events: number;
  list_items: number;
  purchases: number;
  recipes: number;
  notes: number;
  added_7d: number;
  added_30d: number;
  last_active: string | null;
  claude_last_used: string | null;
};

type Stats = {
  generated_at: string;
  totals: Record<
    | "families" | "accounts" | "without_account" | "events" | "list_items" | "purchases" | "recipes" | "notes"
    | "added_7d" | "active_families_7d" | "claude_families_30d" | "push_devices",
    number
  >;
  families: FamilyStats[];
  accounts: { display_name: string; email: string | null; role: string; family: string; created_at: string; last_sign_in_at: string | null }[];
  signups_by_week: { week: string; accounts: number }[];
};

export default function StatsPage() {
  const { supabase, superAdmin, t } = useFamily();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!superAdmin) return;
    supabase.rpc("hembrain_stats").then(({ data, error }) => {
      if (error) setFailed(true);
      else setStats(data as Stats);
    });
  }, [supabase, superAdmin]);

  if (!superAdmin || failed) return <p className="text-muted">{t("Only Hembrain's owner can see this page.")}</p>;
  if (!stats) return <p className="text-muted">{t("Loading…")}</p>;

  const { totals } = stats;
  const when = (d: string | null) => (d ? fmtDateTime(d) : "—");
  const tiles: [string, number][] = [
    [t("Families"), totals.families],
    [t("Active this week"), totals.active_families_7d],
    [t("Accounts"), totals.accounts],
    [t("Kids (no account)"), totals.without_account],
    [t("Added this week"), totals.added_7d],
    [t("Families using Claude"), totals.claude_families_30d],
  ];
  const maxWeek = Math.max(1, ...stats.signups_by_week.map((w) => w.accounts));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader back="/me" title={t("Hembrain stats")} />
        <p className="text-sm text-muted">{t("Counts and dates only, never a family's content.")}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, n]) => (
          <div key={label} className="card">
            <div className="text-2xl font-semibold tabular-nums">{n}</div>
            <div className="text-sm text-muted">{label}</div>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="h2">{t("Everything stored")}</h2>
        <p className="text-sm text-muted">
          {t("{events} events · {items} list items · {purchases} purchases · {recipes} recipes · {notes} notes · {devices} devices with reminders", {
            events: totals.events,
            items: totals.list_items,
            purchases: totals.purchases,
            recipes: totals.recipes,
            notes: totals.notes,
            devices: totals.push_devices,
          })}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="h2">{t("Families")}</h2>
        {stats.families.map((f) => (
          <div key={f.id} className="card flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium">{f.name}</h3>
              <span className="shrink-0 text-xs text-muted">{t("since {date}", { date: fmtDate(f.created_at, { day: "numeric", month: "short" }) })}</span>
            </div>
            <p className="text-sm text-muted">
              {t("{accounts} accounts · {kids} without account", { accounts: f.accounts, kids: f.without_account })}
            </p>
            <p className="text-sm text-muted">
              {t("{events} events · {items} list items · {recipes} recipes · {notes} notes", {
                events: f.events,
                items: f.list_items,
                recipes: f.recipes,
                notes: f.notes,
              })}
            </p>
            <p className="text-sm">
              {t("Added: {week} this week, {month} this month", { week: f.added_7d, month: f.added_30d })}
            </p>
            <p className="text-xs text-muted">
              {t("Last active {date}", { date: when(f.last_active) })}
              {f.claude_last_used && <> · {t("Claude used {date}", { date: when(f.claude_last_used) })}</>}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="h2">{t("Sign-ups per week")}</h2>
        <div className="card flex flex-col gap-2">
          {stats.signups_by_week.length === 0 && <p className="text-sm text-muted">{t("No sign-ups in the last 12 weeks.")}</p>}
          {stats.signups_by_week.map((w) => (
            <div key={w.week} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 text-muted">{fmtDate(w.week, { day: "numeric", month: "short" })}</span>
              <div className="h-2 rounded-full bg-accent" style={{ width: `${(w.accounts / maxWeek) * 100}%`, minWidth: "0.5rem" }} />
              <span className="tabular-nums">{w.accounts}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="h2">{t("Accounts")}</h2>
        <ul className="card flex flex-col divide-y divide-border p-0">
          {stats.accounts.map((a, i) => (
            <li key={`${a.email}-${i}`} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{a.display_name}</span>
                <span className="chip">{t(a.role)}</span>
              </div>
              <span className="break-all text-muted">{a.email}</span>
              <span className="text-xs text-muted">
                {a.family} · {t("joined {date}", { date: fmtDate(a.created_at, { day: "numeric", month: "short" }) })} · {t("last sign-in {date}", { date: when(a.last_sign_in_at) })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
