import Link from "next/link";
import { ModuleIcon } from "./module-icon";
import type { ModuleId } from "@/lib/modules";

// A big square tile that leads somewhere: title, one line of what's inside,
// the module's icon in the corner.
export function HubTile({ href, module, title, sub }: { href: string; module: ModuleId; title: string; sub?: string }) {
  return (
    <Link href={href} className="card flex min-h-32 flex-col justify-between gap-3 p-4 active:scale-[0.98] transition-transform">
      <div className="min-w-0">
        <div className="text-[1.05rem] font-bold leading-tight">{title}</div>
        {sub && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex justify-end">
        <ModuleIcon id={module} />
      </div>
    </Link>
  );
}
