"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: my own space — private tiles (lists, notes, gifts, work) and my trips.
// The family brain is shared, so it lives on Home. Settings live behind the
// avatar, top right (/settings).
export default function MePage() {
  const { supabase, profile, me, t } = useFamily();
  const [trips, setTrips] = useState<number | null>(null);
  useEffect(() => {
    if (!me) return;
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .contains("member_ids", [me.id])
      .then(({ count }) => setTrips(count ?? 0));
  }, [supabase, me]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white" style={{ background: me?.color ?? profile.color }}>
              {(profile.display_name || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{profile.display_name || t("Me")}</span>
          </span>
        }
      />

      <PrivateSpace />

      <nav className="grid grid-cols-2 gap-3">
        <HubTile
          href="/travels/timeline"
          module="travels"
          title={t("My trips")}
          empty={trips === 0}
          sub={trips ? (trips === 1 ? t("1 trip") : t("{n} trips", { n: trips })) : t("Where, when, with whom")}
        />
      </nav>

    </div>
  );
}
