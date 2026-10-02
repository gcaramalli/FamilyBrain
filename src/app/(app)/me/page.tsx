"use client";

import { useFamily } from "@/components/family-context";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: my own space — private tiles (lists, notes, gifts, work), then the
// family's shared ones (brain, papers). Settings live behind the avatar, top right (/settings).
export default function MePage() {
  const { profile, me, t } = useFamily();
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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="h2">{t("Family")}</h2>
          <p className="text-sm text-muted">{t("Shared with everyone in the family.")}</p>
        </div>
        <nav className="grid grid-cols-2 gap-3">
          <HubTile href="/brain" module="brain" title={t("Family brain")} sub={t("Notes and dates worth remembering")} />
          <HubTile href="/papers" module="papers" title={t("Papers")} sub={t("Contracts, insurance, receipts, IDs")} />
        </nav>
      </section>

    </div>
  );
}
