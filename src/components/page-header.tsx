"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFamily } from "./family-context";

// Every screen: title on the left, at most one main action on the right,
// sub-sections as a segmented control underneath.
export function PageHeader({
  title,
  action,
  back,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  back?: string; // sub-pages of Me link back to it
  children?: React.ReactNode;
}) {
  const { t } = useFamily();
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link href={back} className="-mb-2 self-start text-sm text-muted">
          ← {t("Me")}
        </Link>
      )}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="h1 min-w-0">{title}</h1>
        {action && <div className="flex shrink-0 gap-2 [&_.btn]:min-h-10 [&_.btn]:px-4 [&_.btn]:text-sm">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// Segmented control made of links (one route per section).
export function Segments({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid rounded-full bg-accent-soft p-1 text-sm" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((x) => {
        const active = pathname === x.href;
        return (
          <Link
            key={x.href}
            href={x.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-9 items-center justify-center truncate rounded-full px-1 transition-colors ${active ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
          >
            {x.label}
          </Link>
        );
      })}
    </nav>
  );
}

// The Kitchen tab: one loop — plan, buy, cook, remember what we ate.
export function KitchenHeader({ action }: { action?: React.ReactNode }) {
  const { t } = useFamily();
  return (
    <PageHeader title={t("Kitchen")} action={action}>
      <Segments
        items={[
          { href: "/lists", label: t("Shopping") },
          { href: "/meals", label: t("Meals") },
          { href: "/recipes", label: t("Recipes") },
          { href: "/purchases", label: t("Purchases") },
        ]}
      />
    </PageHeader>
  );
}
