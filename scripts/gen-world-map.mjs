// Builds src/lib/world-map.json (country outlines for the Travels map, already
// projected, so the app needs no map library). Run from a scratch folder with
//   npm i world-atlas topojson-client d3-geo i18n-iso-countries
// then `node path/to/gen-world-map.mjs`. Shapes: Natural Earth 1:110m; small
// countries missing there (Monaco, Malta, Hong Kong…) become dots, from 1:50m.
import fs from "fs";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
const load = (r) => { const t = JSON.parse(fs.readFileSync(`node_modules/world-atlas/countries-${r}.json`)); const fc = feature(t, t.objects.countries); fc.features = fc.features.filter(f => f.id !== "010"); return fc; };
const code = (f) => (f.id ? countries.numericToAlpha2(f.id) : f.properties.name === "Kosovo" ? "XK" : undefined);
const coarse = load("110m"), fine = load("50m");
const W = 1000;
const proj = geoEqualEarth().fitWidth(W, coarse);
const gp = geoPath(proj); const path = geoPath(proj).digits(1);
const H = Math.ceil(gp.bounds(coarse)[1][1]);
const shapes = {}, dots = {};
for (const f of coarse.features) { const c = code(f); if (!c) continue; shapes[c] = (shapes[c] ?? "") + path(f); if (gp.area(f) < 12) { const [x,y] = gp.centroid(f); dots[c] = [Math.round(x), Math.round(y)]; } }
for (const f of fine.features) { const c = code(f); if (!c || shapes[c] || dots[c]) continue; const [x,y] = gp.centroid(f); if (!isFinite(x)) continue; dots[c] = [Math.round(x), Math.round(y)]; }
// Zoom presets: [west, south, east, north] in degrees → a viewBox on the projected map.
const box = ([w, s, e, n]) => {
  const pts = [];
  for (let i = 0; i <= 20; i++) for (const [lon, lat] of [[w + ((e - w) * i) / 20, s], [w + ((e - w) * i) / 20, n], [w, s + ((n - s) * i) / 20], [e, s + ((n - s) * i) / 20]]) pts.push(proj([lon, lat]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  return [x, y, Math.ceil(Math.max(...xs)) - x, Math.ceil(Math.max(...ys)) - y];
};
const regions = {
  europe: box([-25, 34, 45, 71]),
  americas: box([-170, -56, -30, 72]),
  asia: box([25, -11, 150, 56]),
  africa: box([-20, -36, 55, 38]),
  oceania: box([110, -48, 180, 0]),
};
const out = new URL("../src/lib/world-map.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify({ width: W, height: H, regions, shapes, dots }));
console.log(Object.keys(shapes).length, "shapes,", Object.keys(dots).length, "dots,", fs.statSync(out).size, "bytes");
