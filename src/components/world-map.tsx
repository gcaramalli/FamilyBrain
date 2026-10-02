"use client";

import { useId } from "react";
import world from "@/lib/world-map.json";
import type { Region } from "@/lib/countries";
import type { Member } from "@/lib/types";

const SHAPES: Record<string, string> = world.shapes;
const DOTS: Record<string, number[]> = world.dots;
const REGION_BOXES = world.regions as Record<Exclude<Region, "world">, number[]>;

// The world, each country in the colour of who has been there; stripes of
// their colours when several of us have. Tiny countries (Monaco, Malta…) are dots.
export function WorldMap({
  who,
  people,
  region = "world",
  onPick,
}: {
  who: Map<string, string[]>; // country → member ids who have been
  people: Member[]; // in this order, the ones shown
  region?: Region;
  onPick?: (code: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const [x, y, w, h] = region === "world" ? [0, 0, world.width, world.height] : REGION_BOXES[region];
  const shown = (code: string) => (who.get(code) ?? []).filter((id) => people.some((p) => p.id === id));
  const patterns = new Map<string, string[]>();
  const fill = (code: string) => {
    const ids = shown(code);
    if (!ids.length) return "var(--map-land)";
    const colors = people.filter((p) => ids.includes(p.id)).map((p) => p.color);
    if (colors.length === 1) return colors[0];
    const key = colors.join("").replace(/[^a-z0-9]/gi, "");
    patterns.set(key, colors);
    return `url(#${uid}${key})`;
  };
  const stroke = w / 1400;
  const pick = onPick ? (code: string) => () => onPick(code) : () => undefined;
  const shapes = Object.entries(SHAPES).map(([code, d]) => (
    <path key={code} d={d} fill={fill(code)} stroke="var(--surface)" strokeWidth={stroke} onClick={pick(code)} className={onPick ? "cursor-pointer" : undefined}>
      {onPick && <title>{code}</title>}
    </path>
  ));
  // Dots go on top and only where nobody can tap a shape; the unvisited ones stay faint.
  const dots = Object.entries(DOTS).map(([code, [cx, cy]]) => {
    const visited = shown(code).length > 0;
    return (
      <circle
        key={code}
        cx={cx}
        cy={cy}
        r={((visited ? 1.4 : 0.9) * w) / 220}
        fill={fill(code)}
        stroke="var(--surface)"
        strokeWidth={stroke}
        opacity={visited ? 1 : 0.7}
        onClick={pick(code)}
        className={onPick ? "cursor-pointer" : undefined}
      />
    );
  });
  const band = Math.max(w / 160, 2);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className="block h-auto w-full" role="img" aria-label="World map">
      <defs>
        {[...patterns].map(([key, colors]) => (
          <pattern key={key} id={uid + key} patternUnits="userSpaceOnUse" width={band * colors.length} height={band * colors.length} patternTransform="rotate(45)">
            {colors.map((c, i) => (
              <rect key={i} x={i * band} y={0} width={band} height={band * colors.length} fill={c} />
            ))}
          </pattern>
        ))}
      </defs>
      {shapes}
      {dots}
    </svg>
  );
}
