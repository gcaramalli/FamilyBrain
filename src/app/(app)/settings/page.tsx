"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { useFamily } from "@/components/family-context";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";

// Settings, behind the avatar (top right): everything set once and looked for
// later. The Me tab (bottom) keeps what is mine to use every day.
export default function SettingsPage() {
  const { supabase, profile, me, superAdmin, t } = useFamily();
  const router = useRouter();
  const toast = useToast();
  const links = [
    { href: "/profile", module: "profile" as const, title: t("Personal settings"), sub: t("Name, colour, language, password") },
    { href: "/connections", module: "connections" as const, title: t("Reminders & AI"), sub: t("Notifications, Claude, ChatGPT") },
    ...(profile.role === "admin" ? [{ href: "/admin", module: "family" as const, title: t("Family settings"), sub: t("People, accounts and invites") }] : []),
    { href: "/feedback", module: "feedback" as const, title: t("Give feedback"), sub: t("An idea, a bug, a wish") },
    ...(superAdmin ? [{ href: "/stats", module: "stats" as const, title: t("Hembrain admin"), sub: t("Usage, feedback, AI budgets") }] : []),
  ];

  // Share the app itself (not the family: joining a family is an invite
  // code, in Family settings).
  async function invite() {
    const url = `${location.origin}/signup`;
    const text = t("We organise our family with Hembrain: calendar, groceries, the kids. Try it:");
    if (navigator.share) {
      await navigator.share({ title: "Hembrain", text, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
    toast(t("Link copied"));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader module="settings" title={t("Settings")} />

      <Link href="/profile" className="card flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white" style={{ background: me?.color ?? profile.color }}>
          {(profile.display_name || "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{profile.display_name}</span>
          <span className="block truncate text-sm text-muted">{profile.email} · {t(profile.role)}</span>
        </span>
      </Link>

      <nav className="grid grid-cols-2 gap-3">
        {links.map((l) => (
          <HubTile key={l.href} href={l.href} module={l.module} title={l.title} sub={l.sub} />
        ))}
      </nav>

      <section className="card flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">{t("Invite a friend")}</h2>
          <p className="text-sm text-muted">{t("Another family who'd like it? Send them the app.")}</p>
        </div>
        <button className="btn shrink-0 gap-2" onClick={invite}>
          <Share2 size={16} /> {t("Share")}
        </button>
      </section>

      <button className="btn-ghost py-3 text-danger" onClick={signOut}>{t("Sign out")}</button>
    </div>
  );
}
