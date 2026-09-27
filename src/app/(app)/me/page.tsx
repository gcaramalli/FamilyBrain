"use client";

import { useFamily } from "@/components/family-context";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: my own space — private tiles (lists, notes, gifts, work) and the
// family brain. Settings live behind the avatar, top right (/settings).
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

      <nav className="grid grid-cols-2 gap-3">
        <HubTile href="/brain" module="brain" title={t("Family brain")} sub={t("Notes and dates worth remembering")} />
      </nav>

    </div>
  );
}
