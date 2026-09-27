"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useFamily } from "./family-context";
import { GiftInbox } from "./gift-inbox";
import { ToastProvider } from "./toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, family, kids, me, t, superAdmin } = useFamily();
  // Service worker: needed for reminders (push notifications).
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // The Kids tab only shows up for families with a child.
  const tabs = [
    { href: "/", label: t("Today"), icon: "🏠" },
    { href: "/calendar", label: t("Calendar"), icon: "📅" },
    ...(kids.length ? [{ href: "/kids", label: kids.length === 1 ? kids[0].name : t("Kids"), icon: kids.length === 1 ? kids[0].emoji : "👶" }] : []),
    { href: "/lists", label: t("Lists"), icon: "🛒" },
    { href: "/recipes", label: t("Recipes"), icon: "🍲" },
    { href: "/brain", label: t("Brain"), icon: "🧠" },
  ];

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <Link href="/" className="font-semibold tracking-tight">{family.name}</Link>
          <div className="flex items-center gap-2">
            {superAdmin && (
              <Link href="/stats" aria-label={t("Stats")} className={`btn-ghost ${pathname.startsWith("/stats") ? "border-foreground" : ""}`}>
                📊
              </Link>
            )}
            {profile.role === "admin" && (
              <Link href="/admin" aria-label={t("Admin")} className={`btn-ghost ${pathname.startsWith("/admin") ? "border-foreground" : ""}`}>
                ⚙️ {t("Admin")}
              </Link>
            )}
            <Link
              href="/profile"
              aria-label={t("Profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: me?.color ?? profile.color }}
            >
              {(profile.display_name || "?").slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

        <GiftInbox />

        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
              const active = isActive(tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-semibold text-foreground" : "text-muted"}`}
                  >
                    <span className={`flex h-8 w-12 items-center justify-center rounded-full text-xl leading-none transition-colors ${active ? "bg-accent-soft" : "grayscale-[40%]"}`}>
                      {tab.icon}
                    </span>
                    <span className="max-w-full truncate px-0.5">{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </ToastProvider>
  );
}
