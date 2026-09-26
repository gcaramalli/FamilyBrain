"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFamily } from "./family-context";
import { GiftInbox } from "./gift-inbox";

const tabs = [
  { href: "/", label: "Today", icon: "🏠" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/lists", label: "Lists", icon: "🛒" },
  { href: "/recipes", label: "Recipes", icon: "🍲" },
  { href: "/brain", label: "Brain", icon: "🧠" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, family } = useFamily();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" className="font-semibold">{family.name}</Link>
        <div className="flex items-center gap-2">
          {profile.role === "admin" && (
            <Link href="/admin" aria-label="Admin" className={`btn-ghost ${pathname.startsWith("/admin") ? "border-accent" : ""}`}>
              ⚙️ Admin
            </Link>
          )}
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: profile.color }}
          >
            {(profile.display_name || "?").slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <GiftInbox />

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${isActive(t.href) ? "text-accent" : "text-muted"}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
