/**
 * Builds the raft catalogue (src/data/huoiVanhRaftCatalogue.json) from the
 * raft outlines, the mooring-line file and the calculation engine. Nothing in
 * the catalogue is hand-tuned; re-run after any change of the outlines or of
 * the line layout:
 *
 *   node scripts/importRaftLayout9.mjs "<plan.dxf>"   (new client plan only)
 *   node scripts/planMooringLayoutV2.mjs
 *   npx vite-node scripts/buildRaftCatalogue.ts [--dry]
 *
 * Rules (the same ones the 12-raft catalogue was built with, now automated):
 *  - area / perimeter      : the outline.
 *  - length × width        : minimum-area bounding rectangle, rounded UP to 0.1 m.
 *  - solarPanelCount       : the plan's total (18,354 panels) shared by area.
 *  - cableCount, shore/bed : counted from the line file.
 *  - bed/shoreAnchorDist   : the SHORTEST lake-bed / shore line, floored to 0.1 m.
 *  - focusFactor           : the earlier calibration is (focus × N) per raft.
 *    A raft keeps the product of the raft it comes from; a MERGED raft takes the
 *    LARGER product of its two parents. This is an assumption: no force-
 *    distribution model exists for the merged shapes.
 *  - cable                 : smallest PES cable with utilisation <= 0.95
 *    (<= 1.0 when none reaches 0.95).
 *  - shore pile (bored D350, round cage) and lake-bed pile (square 350, PA1):
 *    fewest piles per point, then normal-grade steel before CB500-V, then the
 *    shortest pile, then the least steel, with every Broms / bending check
 *    <= 0.95.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState, CABLE_MBL_KN } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, type RaftSummaryItem, type MooringCoordinate } from '../src/data/huoiVanhProject';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '../src/data/huoiVanhRaftCatalogue.json');
const dry = process.argv.includes('--dry');
const polygons: Array<{ id: number; name: string; area_m2: number; perimeter_m: number; points: Array<{ x: number; y: number }> }> =
  JSON.parse(fs.readFileSync(path.join(here, '../src/data/huoiVanhRaftPolygons_v2.json'), 'utf8'));
const lines: MooringCoordinate[] = JSON.parse(fs.readFileSync(path.join(here, '../src/data/huoiVanhCoordinates_v2.json'), 'utf8'));

const TOTAL_PANELS = 18354; // HOHUOIVANH.BỐ TRÍ BÈ PIN.pdf, 2026-10-08
const LIMIT = 0.95;
/** focus × N of the 12-raft calibration, by the raft(s) each new raft comes from. */
const FOCUS_PRODUCT: Record<string, number[]> = {
  'BÈ 1': [0.306 * 19], 'BÈ 2': [0.282 * 20], 'BÈ 3': [0.327 * 21],
  'BÈ 3A': [0.31 * 25, 0.131 * 39], 'BÈ 5A': [0.231 * 25, 0.27 * 26],
  'BÈ 6': [0.2 * 30], 'BÈ 7': [0.169 * 32], 'BÈ 8': [0.18 * 29, 0.3 * 18], 'BÈ 9': [0.327 * 20]
};
const WATER_DEPTH: Record<string, number> = { 'BÈ 1': 6.0 };

// ------------------------------------------------------------------ geometry
type Pt = { x: number; y: number };
function minBoundingRect(pts: Pt[]) {
  let best = { area: Infinity, L: 0, W: 0, angle: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) {
      const u = p.x * ux + p.y * uy, v = -p.x * uy + p.y * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const du = u1 - u0, dv = v1 - v0;
    if (du * dv < best.area - 1e-6) {
      const long = du >= dv;
      const ang = ((Math.atan2(long ? uy : ux, long ? ux : -uy) * 180) / Math.PI + 360) % 180;
      best = { area: du * dv, L: Math.max(du, dv), W: Math.min(du, dv), angle: ang };
    }
  }
  return best;
}
const up1 = (v: number) => Math.ceil(v * 10 - 1e-6) / 10;
const down1 = (v: number) => Math.floor(v * 10 + 1e-6) / 10;

// panels by area, largest remainder
const totalArea = polygons.reduce((s, p) => s + p.area_m2, 0);
const share = polygons.map((p) => (TOTAL_PANELS * p.area_m2) / totalArea);
const panels = share.map(Math.floor);
[...share.map((v, i) => ({ i, f: v - Math.floor(v) }))].sort((a, b) => b.f - a.f).slice(0, TOTAL_PANELS - panels.reduce((s, v) => s + v, 0)).forEach(({ i }) => { panels[i] += 1; });

// ------------------------------------------------------------------ engine helpers
// `--wind=20` sizes a WHAT-IF catalogue at another wind speed; it is never written to disk.
const windArg = process.argv.find((a) => a.startsWith('--wind='));
const WHAT_IF_WIND = windArg ? Number(windArg.split('=')[1]) : undefined;
const base = () => {
  const p = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
  if (WHAT_IF_WIND) p.env.windSpeed_ms = WHAT_IF_WIND;
  return p;
};
function run(row: RaftSummaryItem, option: 'PA1_PILE' | 'PA3_SCREW_BASE' = 'PA1_PILE') {
  const b = base();
  const st = buildRaftProjectState(b, row, b.anchor);
  return calculateProject({ ...st, anchor: { ...st.anchor, bedAnchorOption: option } });
}
const util = (r: ReturnType<typeof run>, id: string) => r.checks.find((c) => c.id === id)?.utilization ?? Infinity;

const CABLES = Object.entries(CABLE_MBL_KN).sort((a, b) => a[1] - b[1]).map(([code]) => code);
const SHORE_CAGES: Array<[number, number]> = [];
for (const n of [4, 6, 8]) for (const d of [25, 28, 32]) SHORE_CAGES.push([n, d]);
SHORE_CAGES.sort((a, b) => a[0] * a[1] * a[1] - b[0] * b[1] * b[1]);
const BED_BARS = [20, 22, 25, 28, 32];

const notes: string[] = [];
const rows: RaftSummaryItem[] = polygons.map((poly, i) => {
  const own = lines.filter((l) => l.raft === poly.name);
  const shore = own.filter((l) => l.type === 'SHORE'), bed = own.filter((l) => l.type === 'BED');
  const rect = minBoundingRect(poly.points);
  const product = Math.max(...FOCUS_PRODUCT[poly.name]);
  let row: RaftSummaryItem = {
    id: poly.id, name: poly.name, area_m2: poly.area_m2, perimeter_m: poly.perimeter_m,
    length_m: up1(rect.L), width_m: up1(rect.W), angle_deg: Math.round(rect.angle * 10) / 10,
    solarPanelCount: panels[i],
    focusFactor: Math.ceil((product / own.length) * 1000 - 1e-6) / 1000,
    cableCount: own.length, shoreAnchors: shore.length, bedAnchors: bed.length,
    selectedCable: CABLES[CABLES.length - 1],
    waterDepth_m: WATER_DEPTH[poly.name] ?? 6.2,
    bedAnchorDist_m: down1(Math.min(...bed.map((l) => l.span))),
    shoreAnchorDist_m: down1(Math.min(...shore.map((l) => l.span))),
    shorePileD_m: 0.35, shorePileL_m: 6.5, bedPileD_m: 0.35, bedPileL_m: 8,
    shoreRebarCount: 6, shoreRebarFaceCount: 2, shoreRebarDia_mm: 28, bedRebarFaceCount: 2, bedRebarDia_mm: 25
  };

  // cable
  const cable = CABLES.find((c) => (run({ ...row, selectedCable: c }).cableUtilization ?? Infinity) <= LIMIT)
    ?? CABLES.find((c) => (run({ ...row, selectedCable: c }).cableUtilization ?? Infinity) <= 1);
  if (!cable) notes.push(`${poly.name}: no PES cable in the list reaches utilisation <= 1.0`);
  row = { ...row, selectedCable: cable ?? CABLES[CABLES.length - 1] };

  // shore pile
  let shoreDone = false;
  search: for (const perPoint of [1, 2, 3]) {
    for (const rs of [350, 435]) {
      for (let L = 6.5; L <= 9.0 + 1e-9; L += 0.5) {
        for (const [n, d] of SHORE_CAGES) {
          const cand: RaftSummaryItem = { ...row, shorePilesPerPoint: perPoint, pileRebarRs_MPa: rs, shorePileL_m: L, shoreRebarCount: n, shoreRebarDia_mm: d };
          const r = run(cand);
          if (util(r, 'BP-1') <= LIMIT && util(r, 'BP-2') <= LIMIT) { row = cand; shoreDone = true; break search; }
        }
      }
    }
  }
  if (!shoreDone) notes.push(`${poly.name}: NO shore pile D350 passes (up to 3 piles per point, 8D32 CB500-V, L 9 m)`);

  // lake-bed pile of option PA1 (kept as the alternative to the screw base), with the steel grade chosen above
  let bedDone = false;
  bedSearch: for (const perPoint of [1, 2, 3]) {
    for (let L = 8; L <= 12 + 1e-9; L += 0.5) {
      for (const d of BED_BARS) {
        const cand: RaftSummaryItem = { ...row, bedPilesPerPoint: perPoint, bedPileL_m: L, bedRebarDia_mm: d };
        const r = run(cand);
        if (util(r, 'BP-3') <= LIMIT && util(r, 'BP-4') <= LIMIT && util(r, 'BP-5') <= LIMIT) { row = cand; bedDone = true; break bedSearch; }
      }
    }
  }
  if (!bedDone) notes.push(`${poly.name}: NO lake-bed pile 350x350 passes (PA1, up to 3 piles per point, L 12 m, 4D32)`);

  // tidy: omit the fields that equal the defaults of a single pile in normal steel
  const out: RaftSummaryItem = { ...row };
  if (out.pileRebarRs_MPa === 350) delete out.pileRebarRs_MPa;
  if (out.shorePilesPerPoint === 1) delete out.shorePilesPerPoint;
  if (out.bedPilesPerPoint === 1) delete out.bedPilesPerPoint;
  return out;
});

// ------------------------------------------------------------------ report
const fx = (v: number | undefined, d = 2) => (v === undefined || !Number.isFinite(v) ? '-' : v.toFixed(d));
for (const row of rows) {
  const p1 = run(row, 'PA1_PILE'), p3 = run(row, 'PA3_SCREW_BASE');
  const sb = p3.bedScrewBase!;
  console.log(
    `${row.name.padEnd(6)} A=${row.area_m2} P=${row.perimeter_m} ${row.length_m}x${row.width_m} N=${row.cableCount} (${row.shoreAnchors}+${row.bedAnchors}) panels=${row.solarPanelCount} ff=${row.focusFactor}` +
    ` | F=${fx(p1.f_env_total_kN, 0)} T=${fx(p1.t_max_intact_kN, 1)} (focus ${fx(p1.t_focus_kN, 1)}, geom ${fx(p1.t_geometric_kN, 1)}) ${row.selectedCable} u=${fx(p1.cableUtilization ?? undefined)}` +
    ` | shore ${row.shorePilesPerPoint ?? 1}x ${row.shoreRebarCount}D${row.shoreRebarDia_mm} Rs${row.pileRebarRs_MPa ?? 350} L${row.shorePileL_m} BP1=${fx(util(p1, 'BP-1'))} BP2=${fx(util(p1, 'BP-2'))}` +
    ` | bedpile ${row.bedPilesPerPoint ?? 1}x 4D${row.bedRebarDia_mm} L${row.bedPileL_m} BP3=${fx(util(p1, 'BP-3'))} BP4=${fx(util(p1, 'BP-4'))} BP5=${fx(util(p1, 'BP-5'))}` +
    ` | base ${sb.side_m}x${sb.side_m}x${sb.thickness_m} ${fx(sb.concrete_m3, 1)}m3 ${fx(sb.liftMass_t, 1)}t ok=${sb.ok} span=${row.bedAnchorDist_m}` +
    ` | PA1 ${p1.overallVerdict} PA3 ${p3.overallVerdict}`
  );
}
console.log(`lines ${rows.reduce((s, r) => s + r.cableCount, 0)}, panels ${rows.reduce((s, r) => s + (r.solarPanelCount ?? 0), 0)}, area ${totalArea}`);
if (notes.length) console.log('NOTES:\n  ' + notes.join('\n  '));
if (WHAT_IF_WIND) console.log(`WHAT-IF at V = ${WHAT_IF_WIND} m/s — nothing written`);
else if (!dry) { fs.writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n'); console.log('written', path.relative(path.join(here, '..'), OUT)); }
