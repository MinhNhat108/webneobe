/**
 * Pure scene model of the Huổi Vanh 3D simulation — every number the canvas
 * draws, computed without WebGL so it can be unit-tested.
 *
 * TWO VERTICAL DATUMS. The project documents give the reservoir levels in the
 * project datum (MNC 380.0, MNDB 384.5, MNLKT 386.0 m, CLAUDE.md). The client's
 * IFC (`dia hinh ho.ifc`) models the same reservoir with its water-surface slab
 * ("Floor:mat nuoc") at 402.0 m. Three independent observations tie them
 * together with ONE offset of +17.5 m (IFC = project + 17.5):
 *   1. IFC water slab 402.0  ↔  MNDB 384.5;
 *   2. IFC lake bed under the rafts 396.0 (6.0 m deep) ↔ the calculation's
 *      design water depth 6.0–6.2 m;
 *   3. the bed-pile elevation stored in the layout (378.5) + 17.5 = 396.0.
 * Everything here is expressed in the PROJECT datum; the IFC terrain is shifted
 * down by the offset on the way in. Before this, the terrain was drawn in the
 * IFC datum while the water was drawn in the project datum, 17.5 m apart, so
 * the water sat under the ground.
 *
 * THE TERRAIN is the IFC Toposolid, rasterised by
 * `scripts/extractTerrainFromIfc.mjs` with an explicit south-to-north row
 * order (the previous height-field was mirrored north-south and flattened
 * under the rafts; it matched the IFC to within 7.6 m on average only).
 *
 * THE PILES are the 304 square RC piles of the V2 layout, each sized per raft
 * from the design catalogue: side `a` and embedment `L_tk`. The head stands at
 * the ground + the stick-up used by the calculation, the toe is `L_tk` below
 * the ground.
 *
 * THE CABLES run straight from the raft cleat to the pile head: the engine
 * models a pile mooring as a taut line (`mooringModel: 'taut_pile'`), with no
 * catenary sag. Their colour is the raft's cable utilisation from the engine.
 */
import terrainMesh from '../../data/huoiVanhTerrainMesh.json';
import pilesV2 from '../../data/huoiVanhPiles_v2.json';
import { HUOI_VANH_RAFTS, HUOI_VANH_DEFAULT_PROJECT, RaftSummaryItem, MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2, RaftPolygonV2 } from '../../data/huoiVanhLayout';
import { calculateProject } from '../../lib/calc';
import { resolveRaftState, type RaftDeviation } from '../../lib/calc/raftState';
import type { ProjectState } from '../../lib/calc/types';

// ------------------------------------------------------------------ levels
/** Mực nước chết. */
export const MNC_M = 380.0;
/** Mực nước dâng bình thường — scene y = 0. */
export const MNDB_M = 384.5;
/** Mực nước lũ kiểm tra. */
export const MNLKT_M = 386.0;

interface TerrainFile {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  nx: number;
  ny: number;
  rowOrder: 'south-to-north';
  ifcWaterSurface_m: number;
  elevations: Array<Array<number | null>>;
}
const TERRAIN = terrainMesh as unknown as TerrainFile;
if (TERRAIN.rowOrder !== 'south-to-north') {
  // A silent mirror is exactly the bug this module was written to remove.
  throw new Error('huoiVanhTerrainMesh.json must be stored south-to-north');
}

/** Top of the IFC water-surface slab, IFC datum. */
export const IFC_WATER_SURFACE_M = TERRAIN.ifcWaterSurface_m;
/** IFC elevation = project elevation + this. */
export const IFC_DATUM_OFFSET_M = Math.round((IFC_WATER_SURFACE_M - MNDB_M) * 1000) / 1000;

/** Horizontal origin of the three.js scene (kept from the original canvas). */
export const ORIGIN_X = 110.33;
export const ORIGIN_Y = 61.66;

/** Plan (x, y) and project elevation z → three.js coordinates. North is −Z. */
export function toScene(x: number, y: number, z: number): { x: number; y: number; z: number } {
  return { x: x - ORIGIN_X, y: z - MNDB_M, z: -(y - ORIGIN_Y) };
}

// ------------------------------------------------------------------ terrain
const { minX, minY, maxX, maxY } = TERRAIN.bounds;
export const TERRAIN_NX = TERRAIN.nx;
export const TERRAIN_NY = TERRAIN.ny;
export const TERRAIN_DX = (maxX - minX) / (TERRAIN.nx - 1);
export const TERRAIN_DY = (maxY - minY) / (TERRAIN.ny - 1);
export const TERRAIN_BOUNDS = TERRAIN.bounds;

/** Ground of grid node (row, col), PROJECT datum; null outside the Toposolid. Row 0 = south. */
export function nodeGround(row: number, col: number): number | null {
  const z = TERRAIN.elevations[row]?.[col];
  return z === null || z === undefined ? null : z - IFC_DATUM_OFFSET_M;
}
export const nodeX = (col: number) => minX + col * TERRAIN_DX;
export const nodeY = (row: number) => minY + row * TERRAIN_DY;

/**
 * Ground elevation at a plan point, PROJECT datum — interpolated on exactly the
 * two triangles the renderer draws for that grid cell (split along the
 * (row, col)–(row+1, col+1) diagonal), so whatever is placed at this height
 * sits on the visible surface, not a few decimetres above or below it.
 */
export function groundAt(x: number, y: number): number | null {
  const fx = (x - minX) / TERRAIN_DX;
  const fy = (y - minY) / TERRAIN_DY;
  if (fx < 0 || fy < 0 || fx > TERRAIN.nx - 1 || fy > TERRAIN.ny - 1) return null;
  const col = Math.min(TERRAIN.nx - 2, Math.floor(fx));
  const row = Math.min(TERRAIN.ny - 2, Math.floor(fy));
  const tx = fx - col;
  const ty = fy - row;
  const p00 = nodeGround(row, col);
  const p01 = nodeGround(row, col + 1);   // +x
  const p10 = nodeGround(row + 1, col);   // +y
  const p11 = nodeGround(row + 1, col + 1);
  if (p00 === null || p01 === null || p10 === null || p11 === null) return null;
  return tx >= ty
    ? p00 + tx * (p01 - p00) + ty * (p11 - p01)
    : p00 + ty * (p10 - p00) + tx * (p11 - p10);
}

/** Triangle indices of the terrain surface, dropping any cell that touches a missing node. */
export function terrainTriangleIndices(): number[] {
  const idx: number[] = [];
  const id = (r: number, c: number) => r * TERRAIN.nx + c;
  for (let r = 0; r < TERRAIN.ny - 1; r++) {
    for (let c = 0; c < TERRAIN.nx - 1; c++) {
      if (nodeGround(r, c) === null || nodeGround(r, c + 1) === null ||
          nodeGround(r + 1, c) === null || nodeGround(r + 1, c + 1) === null) continue;
      // Same diagonal as groundAt(): (r,c)-(r+1,c+1). Wound counter-clockwise
      // seen from above (+y up after the plan→scene mapping, which flips y→−z).
      idx.push(id(r, c), id(r + 1, c + 1), id(r, c + 1));
      idx.push(id(r, c), id(r + 1, c), id(r + 1, c + 1));
    }
  }
  return idx;
}

// ------------------------------------------------------------------ reservoir
const polygonCentroid = (p: RaftPolygonV2) => p.centroid;

function floodFill(level: number, allowed?: Uint8Array): Uint8Array {
  const { nx, ny } = TERRAIN;
  const wet = new Uint8Array(nx * ny);
  const stack: number[] = [];
  for (const p of RAFT_POLYGONS_V2) {
    const c = polygonCentroid(p);
    const col = Math.round((c.x - minX) / TERRAIN_DX);
    const row = Math.round((c.y - minY) / TERRAIN_DY);
    const g = nodeGround(row, col);
    const k = row * nx + col;
    if (g !== null && g < level && !wet[k] && (!allowed || allowed[k])) { wet[k] = 1; stack.push(k); }
  }
  while (stack.length) {
    const k = stack.pop()!;
    const row = Math.floor(k / nx), col = k % nx;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r2 = row + dr, c2 = col + dc;
      if (r2 < 0 || c2 < 0 || r2 >= ny || c2 >= nx) continue;
      const k2 = r2 * nx + c2;
      if (wet[k2] || (allowed && !allowed[k2])) continue;
      const g = nodeGround(r2, c2);
      if (g !== null && g < level) { wet[k2] = 1; stack.push(k2); }
    }
  }
  return wet;
}
const countOf = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

/**
 * Level at which water leaves the reservoir valley over the lowest saddle of
 * the IFC terrain (≈ 386.5 m: just above MNLKT, plausibly the spillway sill).
 * Above it the flooded area jumps by a large factor into neighbouring low
 * ground, which the IFC does not model as reservoir.
 */
export const SPILL_LEVEL_M: number = (() => {
  const base = countOf(floodFill(MNLKT_M));
  let lo = MNLKT_M, hi = MNLKT_M + 12;
  if (countOf(floodFill(hi)) < base * 1.5) return hi; // never spills in range
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (countOf(floodFill(mid)) >= base * 1.5) hi = mid; else lo = mid;
  }
  return Math.round(lo * 100) / 100;
})();

/**
 * The reservoir valley: what floods at MNLKT, widened by a few cells so a
 * higher what-if level can climb the banks. Water is never drawn outside it,
 * so a level above the spill does not pour into neighbouring valleys.
 */
const VALLEY: Uint8Array = (() => {
  const { nx, ny } = TERRAIN;
  let m = floodFill(MNLKT_M);
  for (let pass = 0; pass < 4; pass++) {
    const grown = m.slice();
    for (let k = 0; k < m.length; k++) {
      if (!m[k]) continue;
      const row = Math.floor(k / nx), col = k % nx;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r2 = row + dr, c2 = col + dc;
        if (r2 >= 0 && c2 >= 0 && r2 < ny && c2 < nx) grown[r2 * nx + c2] = 1;
      }
    }
    m = grown;
  }
  return m;
})();

/** Grid nodes under water at `level`, flood-filled from the rafts inside the valley. */
export function wetNodes(level: number): Uint8Array {
  return floodFill(level, VALLEY);
}

/** Water depth at a plan point for a given level (negative = dry ground above water). */
export function depthAt(x: number, y: number, level: number): number | null {
  const g = groundAt(x, y);
  return g === null ? null : level - g;
}

// ------------------------------------------------------------------ rafts
/** Draft of the pontoons (design value, `raft.draft_m`). */
export const RAFT_DRAFT_M = HUOI_VANH_DEFAULT_PROJECT.raft.draft_m ?? 0.2;

export interface RaftModel {
  id: number;
  name: string;
  polygon: RaftPolygonV2;
  /** Highest ground anywhere under the footprint, project datum. */
  shallowestGround_m: number;
  /** Lowest water level at which the whole raft still floats (ground + draft). */
  groundingLevel_m: number;
}

function inPolygon(x: number, y: number, pts: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export const RAFT_MODELS: RaftModel[] = RAFT_POLYGONS_V2.map((polygon) => {
  const xs = polygon.points.map((p) => p.x), ys = polygon.points.map((p) => p.y);
  let shallowest = -Infinity;
  // A 3 m sampling of the footprint: finer than the 9 m terrain grid.
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 3) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 3) {
      if (!inPolygon(x, y, polygon.points)) continue;
      const g = groundAt(x, y);
      if (g !== null && g > shallowest) shallowest = g;
    }
  }
  return {
    id: polygon.id,
    name: polygon.name,
    polygon,
    shallowestGround_m: shallowest,
    groundingLevel_m: shallowest + RAFT_DRAFT_M
  };
});

/**
 * Waterline of a raft at a reservoir level: it floats at the level, or rests
 * on the shallowest ground under it once the water drops below that.
 */
export function raftWaterline(raft: RaftModel, level: number): { waterline_m: number; aground: boolean } {
  return level >= raft.groundingLevel_m
    ? { waterline_m: level, aground: false }
    : { waterline_m: raft.groundingLevel_m, aground: true };
}

// ------------------------------------------------------------------ piles
export interface PileModel {
  /** Pile code (CS-001 … / CD-…). */
  code: string;
  /** Mooring line code of the pile (B1-D01 …). */
  line: string;
  raft: string;
  type: 'SHORE' | 'BED';
  x: number;
  y: number;
  /** Side of the square RC section, m. */
  side_m: number;
  /** Embedded length below the ground (design L_tk), m. */
  embed_m: number;
  /** Free length above the ground, m. */
  stickup_m: number;
  ground_m: number;
  head_m: number;
  toe_m: number;
}

interface PileFileRow { code: string; line: string; raft: string; type: 'SHORE' | 'BED'; shape: string; x: number; y: number }
const PILE_ROWS = pilesV2 as PileFileRow[];
const raftItem = (name: string): RaftSummaryItem => {
  const r = HUOI_VANH_RAFTS.find((q) => q.name === name);
  if (!r) throw new Error(`No catalogue entry for ${name}`);
  return r;
};

/**
 * The 304 piles as built. Side and embedment are the per-raft design values —
 * except for `activeRaft`, the raft being edited in Tab 2, whose piles take
 * the side / L_tk entered there (`anchor.shoreD_m`, `shoreL_m`, `bed1D_m`,
 * `bed1L_m`). The stick-ups are the calculation's own: `anchor.shoreArm_e_m`
 * for a shore pile (the free arm the Broms check loads) and
 * `anchor.bed1Stickup_m` for a lake-bed pile. Plan positions never change.
 */
export function buildPileModels(anchor: Partial<ProjectState['anchor']> = {}, activeRaft?: string): PileModel[] {
  const base = HUOI_VANH_DEFAULT_PROJECT.anchor;
  const shoreStickup = anchor.shoreArm_e_m ?? base.shoreArm_e_m ?? 0.5;
  const bedStickup = anchor.bed1Stickup_m ?? base.bed1Stickup_m ?? 1.0;
  return PILE_ROWS.map((p) => {
    const r = raftItem(p.raft);
    const isShore = p.type === 'SHORE';
    const edited = p.raft === activeRaft;
    const side = (edited ? (isShore ? anchor.shoreD_m : anchor.bed1D_m) : undefined)
      ?? (isShore ? r.shorePileD_m : r.bedPileD_m) ?? (isShore ? base.shoreD_m : base.bed1D_m);
    const embed = (edited ? (isShore ? anchor.shoreL_m : anchor.bed1L_m) : undefined)
      ?? (isShore ? r.shorePileL_m : r.bedPileL_m) ?? (isShore ? base.shoreL_m : base.bed1L_m);
    const stickup = isShore ? shoreStickup : bedStickup;
    const ground = groundAt(p.x, p.y);
    if (ground === null) throw new Error(`Pile ${p.code} lies outside the terrain model`);
    return {
      code: p.code,
      line: p.line,
      raft: p.raft,
      type: p.type,
      x: p.x,
      y: p.y,
      side_m: side,
      embed_m: embed,
      stickup_m: stickup,
      ground_m: ground,
      head_m: ground + stickup,
      toe_m: ground - embed
    };
  });
}

// ------------------------------------------------------------------ cables
export interface CableModel {
  code: string;
  raft: string;
  type: 'SHORE' | 'BED';
  cleat: { x: number; y: number };
  pile: PileModel;
  /** Plan length, m (the layout's `span`). */
  span_m: number;
}

export function buildCableModels(piles: PileModel[]): CableModel[] {
  const byLine = new Map(piles.map((p) => [p.line, p]));
  return MOORING_LINES_V2.map((l: MooringCoordinate) => {
    const pile = byLine.get(l.code);
    if (!pile) throw new Error(`No pile for mooring line ${l.code}`);
    return { code: l.code, raft: l.raft, type: l.type, cleat: { x: l.xRaft, y: l.yRaft }, pile, span_m: l.span };
  });
}

/** Height of the cleat above the raft waterline (pontoon freeboard). */
export const CLEAT_ABOVE_WATERLINE_M = HUOI_VANH_DEFAULT_PROJECT.raft.freeboardHeight_m ?? 0.35;

// ------------------------------------------------------------------ engine
export interface RaftMooringState {
  name: string;
  cable: string;
  /** Total environmental force on the raft (wind + current + wave), kN. */
  envForce_kN: number;
  /** Governing line tension from the engine, kN. */
  tension_kN: number;
  /** Cable minimum breaking load, kN. */
  mbl_kN: number;
  /** Engine cable utilisation (MBL required / MBL). */
  cableUtil: number;
  /** MBL / T_max. */
  safetyFactor: number;
  /** Governing utilisation of the shore and lake-bed piles (Broms, BP-1…BP-5). */
  shorePileUtil: number;
  bedPileUtil: number;
  verdict: 'PASS' | 'FAIL' | 'NA' | 'SKIP';
  /** The raft being edited in Tab 2: its values are the Tab 2 inputs. */
  isActive: boolean;
  /** Tab 2 inputs of the active raft that differ from the frozen design (empty = as designed). */
  deviations: RaftDeviation[];
}

/**
 * Runs the calculation engine for every raft at a given wind speed. The
 * engine gives the GOVERNING line tension of a raft (worst direction); it has
 * no per-line or per-direction model, so every cable of a raft shows that
 * raft's value — showing a per-line spread would be invented precision.
 */
export function computeRaftMooringStates(
  base: ProjectState,
  windSpeed_ms: number,
  activeRaftId: number = base.activeRaftId ?? 0
): Map<string, RaftMooringState> {
  const defaultAnchor = HUOI_VANH_DEFAULT_PROJECT.anchor as ProjectState['anchor'];
  const out = new Map<string, RaftMooringState>();
  for (const item of HUOI_VANH_RAFTS) {
    const resolved = resolveRaftState(base, activeRaftId, item, defaultAnchor);
    const s = { ...resolved.state, env: { ...resolved.state.env, windSpeed_ms } };
    const r = calculateProject(s);
    const sp = r.shorePile, bp = r.bedPile1;
    out.set(item.name, {
      name: item.name,
      cable: s.line.cableCode ?? item.selectedCable,
      envForce_kN: r.f_env_total_kN,
      tension_kN: r.t_max_intact_kN,
      mbl_kN: s.line.mbl_kN,
      cableUtil: r.cableUtilization ?? r.mbl_required_kN / s.line.mbl_kN,
      safetyFactor: s.line.mbl_kN / r.t_max_intact_kN,
      shorePileUtil: sp ? Math.max(sp.utilization_H, sp.utilization_M) : 0,
      bedPileUtil: bp ? Math.max(bp.utilization_H, bp.utilization_M, bp.utilization_Uplift ?? 0) : 0,
      verdict: r.overallVerdict,
      isActive: resolved.isActive,
      deviations: resolved.deviations
    });
  }
  return out;
}

/** Same colour bands as the 2D layout map: < 0.7 safe, 0.7–1.0 watch, > 1.0 over. */
export function utilisationColour(u: number): number {
  if (!Number.isFinite(u) || u > 1.0) return 0xef4444;
  if (u >= 0.7) return 0xf59e0b;
  return 0x10b981;
}
