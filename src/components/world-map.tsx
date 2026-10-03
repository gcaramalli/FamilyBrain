"use client";

import world from "@/lib/world-map.json";
import type { Region } from "@/lib/countries";
import type { Member } from "@/lib/types";

const SHAPES: Record<string, string> = world.shapes;
const DOTS: Record<string, number[]> = world.dots;
const REGION_BOXES = world.regions as Record<Exclude<Region, "world">, number[]>;

// The world, each country in the colour of who has been there. Where both
// parents have been it turns ink (dark by day, white at night): "us". A kid
// with a parent keeps the parent's colour. Tiny countries (Monaco, Malta…) are dots.
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
  const [x, y, w, h] = region === "world" ? [0, 0, world.width, world.height] : REGION_BOXES[region];
  const parents = people.filter((p) => p.profile_id);
  const fill = (code: string) => {
    const ids = (who.get(code) ?? []).filter((id) => people.some((p) => p.id === id));
    if (!ids.length) return "var(--map-land)";
    if (parents.length > 1 && parents.every((p) => ids.includes(p.id))) return "var(--foreground)";
    const went = people.filter((p) => ids.includes(p.id));
    return (went.find((p) => p.profile_id) ?? went[0]).color;
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
    const visited = fill(code) !== "var(--map-land)";
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
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className="block h-auto w-full" role="img" aria-label="World map">
      {shapes}
      {dots}
    </svg>
  );
}
