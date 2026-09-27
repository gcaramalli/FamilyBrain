"use client";

import Link from "next/link";
import { useFamily } from "@/components/family-context";
import { PageHeader } from "@/components/page-header";
import { PrivateSpace } from "@/components/private-space";

// Me: my private tiles first, then everything that is set once and looked
// for later (profile, reminders, AI, family settings).
export default function MePage() {
  const { profile, me, superAdmin, t } = useFamily();
  const links = [
    { href: "/profile", title: t("Profile"), sub: t("Name, colour, language, password") },
    { href: "/connections", title: t("Reminders & AI"), sub: t("Notifications, Claude, ChatGPT") },
    { href: "/brain", title: t("Family brain"), sub: t("Notes and dates worth remembering") },
    ...(profile.role === "admin" ? [{ href: "/admin", title: t("Family settings"), sub: t("People, accounts and invites") }] : []),
    ...(superAdmin ? [{ href: "/stats", title: t("Hembrain stats"), sub: t("All families, counts only") }] : []),
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

      <nav className="card divide-y divide-border py-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="font-medium">{l.title}</div>
              <p className="truncate text-sm text-muted">{l.sub}</p>
            </div>
            <span className="text-muted">→</span>
          </Link>
        ))}
      </nav>

    </div>
  );
}
