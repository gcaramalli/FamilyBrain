import Link from "next/link";
import { ModuleIcon } from "./module-icon";
import type { ModuleId } from "@/lib/modules";

// A big square tile that leads somewhere: title, one line of what's inside,
// the module's icon in the corner. `empty` = an optional part nobody has
// filled in yet: drawn dashed, with a line saying what it is for.
export function HubTile({ href, module, title, sub, empty }: { href: string; module: ModuleId; title: string; sub?: string; empty?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-32 flex-col justify-between gap-3 p-4 active:scale-[0.98] transition-transform ${empty ? "rounded-[22px] border border-dashed border-border text-muted" : "card"}`}
    >
      <div className="min-w-0">
        <div className="text-[1.05rem] font-bold leading-tight">{empty ? `+ ${title}` : title}</div>
        {sub && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{sub}</p>}
      </div>
      <div className={`flex justify-end ${empty ? "opacity-50" : ""}`}>
        <ModuleIcon id={module} />
      </div>
    </Link>
  );
}
