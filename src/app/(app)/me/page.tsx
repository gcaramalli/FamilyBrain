"use client";

import { useFamily } from "@/components/family-context";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: what's only mine — private tiles (lists, notes, gifts, work). What the
// family shares (brain, papers) is on Home. Settings live behind the
// avatar, top right (/settings).
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

    </div>
  );
}
