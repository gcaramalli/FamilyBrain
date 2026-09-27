"use client";

import { useCallback, useEffect, useState } from "react";
import { useFamily } from "./family-context";
import { fmtDate } from "@/lib/dates";

type Purchase = { id: string; item_name: string; purchased_at: string; source: string; store: string | null; price: number | null };

// What the family bought (checked off the list, logged by hand, or from a
// receipt). Feeds the "running out soon" prediction.
export function Purchases({ refreshKey }: { refreshKey?: number }) {
  const { supabase, t } = useFamily();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [bought, setBought] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("purchases")
      .select("id, item_name, purchased_at, source, store, price")
      .order("purchased_at", { ascending: false })
      .limit(80);
    setRows((data ?? []) as Purchase[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function log(e: React.FormEvent) {
    e.preventDefault();
    if (!bought.trim()) return;
    await supabase.from("purchases").insert({ item_name: bought.trim(), source: "manual" });
    setBought("");
    load();
  }

  // Group by day, newest first.
  const days = new Map<string, Purchase[]>();
  for (const p of rows) {
    const k = p.purchased_at.slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), p]);
  }
  const source = (p: Purchase) => p.store ?? (p.source === "list" ? t("from the list") : p.source === "receipt" ? t("receipt") : t("logged by hand"));

  return (
    <div className="flex flex-col gap-4">
          <form onSubmit={log} className="flex gap-2">
            <input className="input" placeholder={t("I just bought… (toothpaste)")} value={bought} onChange={(e) => setBought(e.target.value)} />
        <button className="btn">{t("Log")}</button>
      </form>
      <p className="text-xs text-muted">{t("Checked-off shopping items land here automatically. Log what you buy outside the list so the app learns how often you need it.")}</p>
      {[...days.entries()].map(([day, list]) => (
        <section key={day}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{fmtDate(day + "T12:00:00", { weekday: "short", day: "numeric", month: "short" })}</h3>
          <ul className="divide-y divide-border text-sm">
            {list.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-1.5">
                <span>{p.item_name}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {source(p)}
                  {p.price != null && ` · ${p.price} kr`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted">{t("Nothing logged yet.")}</p>}
</div>
  );
}
