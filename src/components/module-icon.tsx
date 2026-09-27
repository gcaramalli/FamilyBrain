import { MODULES, type ModuleId } from "@/lib/modules";

// Duotone icon on a tinted square, in the module's colour.
export function ModuleIcon({ id, size = 44 }: { id: ModuleId; size?: number }) {
  const { color, Icon } = MODULES[id];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[30%]"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.25} fill="currentColor" fillOpacity={0.22} />
    </span>
  );
}
