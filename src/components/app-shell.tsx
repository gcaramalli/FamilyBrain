"use client";

import { CalendarDays, CookingPot, House, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MODULES } from "@/lib/modules";
import { useFamily } from "./family-context";
import { GiftInbox } from "./gift-inbox";
import { ToastProvider } from "./toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, family, kids, me, t } = useFamily();
  // Service worker: needed for reminders (push notifications).
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  // Five tabs, one job each. Sub-pages light up the tab they belong to.
  const KITCHEN = ["/lists", "/meals", "/recipes", "/purchases"];
  const ME = ["/me", "/profile", "/connections", "/admin", "/stats", "/brain"];
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/lists" ? KITCHEN.some((p) => pathname.startsWith(p)) : href === "/me" ? ME.some((p) => pathname.startsWith(p)) : pathname.startsWith(href);

  // The Kids tab only shows up for families with a child, in the middle.
  const tabs = [
    { href: "/", label: t("Today"), icon: <House size={20} />, color: MODULES.today.color },
    { href: "/calendar", label: t("Calendar"), icon: <CalendarDays size={20} />, color: MODULES.calendar.color },
    ...(kids.length
      ? [
          {
            href: "/kids",
            label: kids.length === 1 ? kids[0].name : t("Kids"),
            color: kids[0].color,
            // Colour means a person: the kid's tab wears the kid's colour.
            icon:
              kids.length === 1 ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: kids[0].color }}>
                  {kids[0].name.slice(0, 1)}
                </span>
              ) : (
                <Users size={20} />
              ),
          },
        ]
      : []),
    { href: "/lists", label: t("Kitchen"), icon: <CookingPot size={20} />, color: MODULES.kitchen.color },
    { href: "/me", label: t("Me"), icon: <UserRound size={20} />, color: MODULES.me.color },
  ];

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background/85 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
          <Link href="/" className="text-sm font-medium tracking-tight text-muted">{family.name}</Link>
          <Link
            href="/me"
            aria-label={t("Me")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: me?.color ?? profile.color }}
          >
            {(profile.display_name || "?").slice(0, 1).toUpperCase()}
          </Link>
        </header>

        <main className="flex-1 px-4 pb-32 pt-2">{children}</main>

        <GiftInbox />

        {/* Floating tab bar; the active tab lights up in its module colour. */}
        <nav className="fixed inset-x-0 bottom-0 z-10 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <ul className="mx-auto grid max-w-xl rounded-[26px] bg-surface/95 px-1 backdrop-blur-md" style={{ boxShadow: "0 10px 30px -12px rgba(28,27,25,.28), 0 1px 2px rgba(28,27,25,.06)", border: "1px solid var(--edge)", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
              const active = isActive(tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] ${active ? "font-semibold text-foreground" : "text-muted"}`}
                  >
                    <span
                      className="flex h-8 w-14 items-center justify-center rounded-full transition-colors"
                      style={active ? { background: `color-mix(in srgb, ${tab.color} 20%, transparent)`, color: tab.color } : undefined}
                    >
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
