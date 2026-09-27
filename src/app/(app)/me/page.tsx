"use client";

import { useFamily } from "@/components/family-context";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: my private tiles first, then everything that is set once and looked
// for later (profile, reminders, AI, family settings).
export default function MePage() {
  const { profile, me, superAdmin, t } = useFamily();
  const links = [
    { href: "/brain", module: "brain" as const, title: t("Family brain"), sub: t("Notes and dates worth remembering") },
    { href: "/connections", module: "connections" as const, title: t("Reminders & AI"), sub: t("Notifications, Claude, ChatGPT") },
    { href: "/profile", module: "profile" as const, title: t("Profile"), sub: t("Name, colour, language, password") },
    ...(profile.role === "admin" ? [{ href: "/admin", module: "family" as const, title: t("Family settings"), sub: t("People, accounts and invites") }] : []),
    ...(superAdmin ? [{ href: "/stats", module: "stats" as const, title: t("Hembrain stats"), sub: t("All families, counts only") }] : []),
  ];
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
        {links.map((l) => (
          <HubTile key={l.href} href={l.href} module={l.module} title={l.title} sub={l.sub} />
        ))}
      </nav>

    </div>
  );
}
