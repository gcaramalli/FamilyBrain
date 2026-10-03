"use client";

import { useCallback, useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { MemberBadge } from "@/components/member-select";
import { PageHeader } from "@/components/page-header";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { dayKey, fmtDate } from "@/lib/dates";
import { fmtMoney, settleUp } from "@/lib/expenses";
import { BCP47 } from "@/lib/i18n";
import type { Expense } from "@/lib/types";

type Draft = { id?: string; title: string; amount: string; paid_by: string; split_among: string[]; spent_on: string };

// Shared expenses, a small Tricount: one of us pays for the family, the app
// splits it and says who owes whom. Paying back is logged as a settlement.
export default function ExpensesPage() {
  const { supabase, members, me, locale, t } = useFamily();
  const toast = useToast();
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  // Only the adults (accounts) pay and share; a kid's nappies are split between the parents.
  const adults = members.filter((m) => m.profile_id);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  const money = (n: number, cur: string) => fmtMoney(n, cur, BCP47[locale]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false });
    setRows((data ?? []) as Expense[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase.channel("expenses").on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, load).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const fresh = (): Draft => ({ title: "", amount: "", paid_by: me?.id ?? adults[0]?.id ?? "", split_among: adults.map((m) => m.id), spent_on: dayKey(new Date()) });
  const amountOf = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const amount = amountOf(editing.amount);
    if (!editing.title.trim() || !(amount > 0) || !editing.split_among.length) return;
    const fields = { title: editing.title.trim(), amount, paid_by: editing.paid_by, split_among: editing.split_among, spent_on: editing.spent_on };
    if (editing.id) await supabase.from("expenses").update(fields).eq("id", editing.id);
    else await supabase.from("expenses").insert(fields);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    const before = rows?.find((r) => r.id === id);
    await supabase.from("expenses").delete().eq("id", id);
    setEditing(null);
    load();
    if (before) {
      toast(t("Expense deleted"), async () => {
        await supabase.from("expenses").insert(before);
        load();
      });
    }
  }

  async function settle(from: string, to: string, amount: number, currency: string) {
    const { data } = await supabase
      .from("expenses")
      .insert({ title: "Paid back", amount, currency, paid_by: from, split_among: [to], settlement: true })
      .select("id")
      .single();
    load();
    toast(t("{from} paid {to} back", { from: name(from), to: name(to) }), async () => {
      if (data) await supabase.from("expenses").delete().eq("id", data.id);
      load();
    });
  }

  const transfers = settleUp(rows ?? []);
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const spentThisMonth = (rows ?? []).filter((r) => !r.settlement && r.spent_on.startsWith(thisMonth) && r.currency === "SEK").reduce((s, r) => s + Number(r.amount), 0);
  const months = new Map<string, Expense[]>();
  for (const r of rows ?? []) months.set(r.spent_on.slice(0, 7), [...(months.get(r.spent_on.slice(0, 7)) ?? []), r]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        module="expenses"
        back="/"
        backLabel={t("Home")}
        title={t("Expenses")}
        action={<button className="btn" onClick={() => setEditing(fresh())}>+ {t("Expense")}</button>}
      />

      {rows && (
        <section className="card flex flex-col gap-3">
          {transfers.length === 0 ? (
            <p className="font-semibold">{t("All square")}</p>
          ) : (
            transfers.map((x) => (
              <div key={`${x.from}-${x.to}-${x.currency}`} className="flex items-center justify-between gap-3">
                <p className="min-w-0">
                  <span className="block text-sm text-muted">{t("{from} owes {to}", { from: name(x.from), to: name(x.to) })}</span>
                  <span className="text-2xl font-bold tabular-nums">{money(x.amount, x.currency)}</span>
                </p>
                <button className="btn-ghost shrink-0" onClick={() => settle(x.from, x.to, x.amount, x.currency)}>{t("Settle up")}</button>
              </div>
            ))
          )}
          <p className="text-sm text-muted">{t("Spent this month: {amount}", { amount: money(spentThisMonth, "SEK") })}</p>
        </section>
      )}

      {rows?.length === 0 && (
        <p className="rounded-[22px] border border-dashed border-border p-4 text-sm text-muted">
          {t("Log what one of you paid for the family (toilet paper, the plumber, a gift) and the app keeps the balance. Or tell Claude: “I paid 89 kr for toilet paper”.")}
        </p>
      )}

      {[...months].map(([month, list]) => (
        <section key={month}>
          <h3 className="text-sm font-medium capitalize text-muted">{fmtDate(new Date(`${month}-15T12:00:00`), { month: "long", year: "numeric" })}</h3>
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  className={`flex min-h-12 w-full items-center gap-3 py-2 text-left ${r.settlement ? "text-muted" : ""}`}
                  onClick={() =>
                    r.settlement
                      ? remove(r.id)
                      : setEditing({ id: r.id, title: r.title, amount: String(r.amount), paid_by: r.paid_by, split_among: r.split_among, spent_on: r.spent_on })
                  }
                  aria-label={r.settlement ? t("Undo this payback") : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {r.settlement ? t("{from} paid {to} back", { from: name(r.paid_by), to: name(r.split_among[0]) }) : r.title}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {fmtDate(new Date(`${r.spent_on}T12:00:00`), { day: "numeric", month: "short" })}
                      {!r.settlement && <MemberBadge id={r.paid_by} />}
                      {!r.settlement && r.split_among.length < adults.length && <span>· {t("for {names}", { names: r.split_among.map(name).join(", ") })}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(Number(r.amount), r.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("Edit expense") : t("New expense")}>
        {editing && (
          <form className="flex flex-col gap-3" onSubmit={save}>
            <input className="input" autoFocus={!editing.id} required maxLength={200} placeholder={t("What? (toilet paper)")} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" inputMode="decimal" required placeholder={t("Amount (kr)")} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
              <input className="input" type="date" value={editing.spent_on} onChange={(e) => setEditing({ ...editing, spent_on: e.target.value })} />
            </div>
            <p className="text-sm font-medium">{t("Paid by")}</p>
            <div className="flex flex-wrap gap-2">
              {adults.map((m) => (
                <button type="button" key={m.id} className={`chip-toggle ${editing.paid_by === m.id ? "chip-on" : ""}`} onClick={() => setEditing({ ...editing, paid_by: m.id })}>
                  {m.name}
                </button>
              ))}
            </div>
            <p className="text-sm font-medium">{t("Split between")}</p>
            <div className="flex flex-wrap gap-2">
              {adults.map((m) => {
                const on = editing.split_among.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    className={`chip-toggle ${on ? "chip-on" : ""}`}
                    onClick={() => setEditing({ ...editing, split_among: on ? editing.split_among.filter((x) => x !== m.id) : [...editing.split_among, m.id] })}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={!editing.title.trim() || !(amountOf(editing.amount) > 0) || !editing.split_among.length}>{t("Save")}</button>
              {editing.id && <button type="button" className="btn-ghost text-danger" onClick={() => remove(editing.id!)}>{t("Delete")}</button>}
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
