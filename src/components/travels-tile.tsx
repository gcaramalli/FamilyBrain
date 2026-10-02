"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamily } from "./family-context";
import { ModuleIcon } from "./module-icon";
import { WorldMap } from "./world-map";
import { whoWent } from "@/lib/countries";

// Today → Travels: the family's map at a glance. Loaded lazily (the map's
// outlines weigh ~110 kB) so it never slows the rest of Today down.
export default function TravelsTile() {
  const { supabase, members, t } = useFamily();
  const [rows, setRows] = useState<{ country: string; member_id: string }[] | null>(null);

  useEffect(() => {
    supabase
      .from("visited_countries")
      .select("country, member_id")
      .then(({ data }) => setRows(data ?? []));
  }, [supabase]);

  const who = whoWent(rows ?? []);
  return (
    <Link href="/travels" className="card col-span-2 flex flex-col gap-3 p-4 active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[1.05rem] font-bold leading-tight">{t("Travels")}</div>
          <p className="mt-0.5 text-sm text-muted">
            {rows === null ? "…" : who.size === 0 ? t("Where have we been?") : who.size === 1 ? t("1 country") : t("{n} countries", { n: who.size })}
          </p>
        </div>
        <ModuleIcon id="travels" />
      </div>
      <WorldMap who={who} people={members} />
    </Link>
  );
}
