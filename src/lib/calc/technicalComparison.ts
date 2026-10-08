/**
 * PA1 (driven square RC piles — the design) against PA2 (gravity blocks at the
 * lake-bed points): a purely TECHNICAL side-by-side — geometry, mass, concrete
 * volume, footprint and safety factors.
 *
 * Everything is computed from the same engine run as the rest of the app
 * (`resolveRaftState` + `calculateProject`); the block of each raft is sized
 * with the project's own `anchor.deadweight` parameters, whichever option is
 * currently selected.
 */
import { calculateProject } from './index';
import { resolveRaftState } from './raftState';
import { sizeDeadweightBlock, DeadweightResult, DeadweightParams, DEADWEIGHT_DEFAULTS } from './deadweight';
import type { AnchorInput, ProjectState } from './types';
import type { RaftSummaryItem } from '../../data/huoiVanhProject';

export type MooringOption = 'PA1_PILE' | 'PA2_DEADWEIGHT' | 'PA3_SCREW_BASE';

/** The block parameters a project uses (its own, or the defaults). */
export const deadweightParamsOf = (anchor: Pick<AnchorInput, 'deadweight'>): DeadweightParams => ({
  ...DEADWEIGHT_DEFAULTS,
  ...(anchor.deadweight ?? {})
});

export interface PileGeometry {
  side_m: number;
  /** L_tk + stick-up, m. */
  length_m: number;
  volume_m3: number;
  mass_t: number;
  /** Cross-section on the bed, m². */
  footprint_m2: number;
}

export interface RaftOptionRow {
  name: string;
  /** This raft uses trial inputs from Tab 2 that differ from the frozen design. */
  isTrial: boolean;
  shoreCount: number;
  bedCount: number;
  /** Piles per shore / lake-bed anchor point (2 = twin piles). */
  shorePilesPerPoint: number;
  bedPilesPerPoint: number;
  tension_kN: number;
  bedCableAngle_deg: number;
  shorePile: PileGeometry;
  bedPile: PileGeometry;
  /** Governing Broms utilisation of the PA1 lake-bed pile (lateral, uplift, bending). */
  bedPileUtil: number | null;
  block: DeadweightResult;
}

export interface TechnicalComparison {
  params: DeadweightParams;
  rows: RaftOptionRow[];
  shoreCount: number;
  bedCount: number;
  /** Number of PILES (an anchor point may hold more than one). */
  shorePileCount: number;
  pa1BedPileCount: number;
  /** Concrete of the shore piles (identical in both options), of the PA1 bed piles and of the PA2 blocks, m³. */
  shoreConcrete_m3: number;
  pa1BedConcrete_m3: number;
  pa2BedConcrete_m3: number;
  /** PA2 / PA1 lake-bed concrete. */
  concreteRatio: number;
  /** Lake bed covered by the bed anchors, m². */
  pa1BedFootprint_m2: number;
  pa2BedFootprint_m2: number;
  /** Ranges over the rafts that have bed anchors. */
  bedPileSide_m: [number, number];
  bedPileMass_t: [number, number];
  blockSide_m: [number, number];
  blockHeight_m: [number, number];
  blockMass_t: [number, number];
  blockBaseArea_m2: [number, number];
  /** Every block meets sliding, uplift, overturning and bearing. */
  allBlocksOk: boolean;
  /** Rafts whose block could not be made to pass (e.g. q_allow too low). */
  failingRafts: string[];
}

const range = (v: number[]): [number, number] => (v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]);

export function compareMooringOptions(
  current: ProjectState,
  activeRaftId: number,
  rafts: RaftSummaryItem[],
  defaultAnchor: AnchorInput
): TechnicalComparison {
  const params = deadweightParamsOf(current.anchor);
  const rho = params.rhoConcrete_tm3;
  // `side` is the side of a square pile or the diameter of a round one.
  const pile = (side: number, length: number, shape: AnchorInput['shorePileShape'] = 'square'): PileGeometry => {
    const area = shape === 'square' || shape === undefined ? side * side : (Math.PI * side * side) / 4;
    return { side_m: side, length_m: length, volume_m3: area * length, mass_t: area * length * rho, footprint_m2: area };
  };

  const rows: RaftOptionRow[] = [];
  let shorePiles = 0, bedPiles = 0;
  let shoreN = 0, bedN = 0, shoreVol = 0, bedVol = 0, blockVol = 0, bedFoot = 0, blockFoot = 0;

  for (const item of rafts) {
    const { state, deviations } = resolveRaftState(current, activeRaftId, item, defaultAnchor);
    // The PA1 pile utilisation is needed whichever option is selected.
    const r = calculateProject({ ...state, anchor: { ...state.anchor, bedAnchorOption: 'PA1_PILE' } });
    const nShore = state.line.shoreLineCount ?? item.shoreAnchors;
    const nBed = state.line.bedLineCount ?? item.bedAnchors;

    const shorePile = pile(state.anchor.shoreD_m, state.anchor.shoreL_m + (state.anchor.shoreArm_e_m ?? 0), state.anchor.shorePileShape);
    const bedPile = pile(state.anchor.bed1D_m, state.anchor.bed1L_m + (state.anchor.bed1Stickup_m ?? 0), state.anchor.bedPileShape);
    const angle = r.bedCableAngle_deg ?? 0;
    const block = sizeDeadweightBlock({ tension_kN: r.t_max_intact_kN, cableAngle_deg: angle, ...params });
    const bp = r.bedPile1;

    const perShore = Math.max(1, Math.floor(state.anchor.shorePilesPerPoint ?? 1));
    const perBed = Math.max(1, Math.floor(state.anchor.bedPilesPerPoint ?? 1));
    shoreN += nShore; shorePiles += nShore * perShore; shoreVol += nShore * perShore * shorePile.volume_m3;
    bedN += nBed; bedPiles += nBed * perBed; bedVol += nBed * perBed * bedPile.volume_m3; bedFoot += nBed * perBed * bedPile.footprint_m2;
    blockVol += nBed * block.volume_m3; blockFoot += nBed * block.baseArea_m2;

    rows.push({
      name: item.name,
      isTrial: deviations.length > 0,
      shoreCount: nShore,
      bedCount: nBed,
      shorePilesPerPoint: perShore,
      bedPilesPerPoint: perBed,
      tension_kN: r.t_max_intact_kN,
      bedCableAngle_deg: angle,
      shorePile,
      bedPile,
      bedPileUtil: bp ? Math.max(bp.utilization_H, bp.utilization_M, bp.utilization_Uplift ?? 0) : null,
      block
    });
  }

  const withBed = rows.filter((x) => x.bedCount > 0);
  return {
    params,
    rows,
    shoreCount: shoreN,
    bedCount: bedN,
    shorePileCount: shorePiles,
    pa1BedPileCount: bedPiles,
    shoreConcrete_m3: shoreVol,
    pa1BedConcrete_m3: bedVol,
    pa2BedConcrete_m3: blockVol,
    concreteRatio: bedVol > 0 ? blockVol / bedVol : 0,
    pa1BedFootprint_m2: bedFoot,
    pa2BedFootprint_m2: blockFoot,
    bedPileSide_m: range(withBed.map((x) => x.bedPile.side_m)),
    bedPileMass_t: range(withBed.map((x) => x.bedPile.mass_t)),
    blockSide_m: range(withBed.map((x) => x.block.L_m)),
    blockHeight_m: range(withBed.map((x) => x.block.H_m)),
    blockMass_t: range(withBed.map((x) => x.block.mass_t)),
    blockBaseArea_m2: range(withBed.map((x) => x.block.baseArea_m2)),
    allBlocksOk: withBed.every((x) => x.block.ok),
    failingRafts: withBed.filter((x) => !x.block.ok).map((x) => x.name)
  };
}
