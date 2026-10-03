/**
 * PA1 (driven square RC piles, the design) vs PA2 (gravity blocks at the 175
 * lake-bed points) — quantities and cost, for the owner's comparison.
 *
 * Everything here is COMPUTED from the same engine run as the rest of the app
 * (`resolveRaftState` + `calculateProject`); nothing is a fixed headline
 * figure. The unit prices are editable ASSUMPTIONS, not a published norm, and
 * the result is only as good as they are.
 */
import { calculateProject } from './index';
import { resolveRaftState } from './raftState';
import { sizeDeadweightBlock, DeadweightResult, DEADWEIGHT_DEFAULTS } from './deadweight';
import type { AnchorInput, ProjectState } from './types';
import type { RaftSummaryItem } from '../../data/huoiVanhProject';

export type MooringOption = 'PA1_PILE' | 'PA2_DEADWEIGHT';

export interface CostInputs {
  concrete_vnd_m3: number;
  steel_vnd_kg: number;
  formwork_vnd_m2: number;
  /** Reinforcement ratio of a driven pile / a gravity block, kg per m³ of concrete. */
  pileSteel_kg_m3: number;
  blockSteel_kg_m3: number;
  /** Driving one pile (barge + hammer), VND. */
  pileDriving_vnd: number;
  /** One floating-crane lift placing a block unit, VND. */
  blockLift_vnd: number;
  /** Heaviest unit the floating crane can place, t. An anchor heavier than this is cast and placed as several units. */
  craneCapacity_t: number;
  /** Block–mud friction and safety factors of PA2. */
  mu: number;
  sfUplift: number;
  sfSlide: number;
}

export const DEFAULT_COST_INPUTS: CostInputs = {
  concrete_vnd_m3: 1_800_000,
  steel_vnd_kg: 18_000,
  formwork_vnd_m2: 150_000,
  pileSteel_kg_m3: 130,
  blockSteel_kg_m3: 50,
  pileDriving_vnd: 3_500_000,
  blockLift_vnd: 25_000_000,
  craneCapacity_t: 50,
  mu: DEADWEIGHT_DEFAULTS.mu,
  sfUplift: DEADWEIGHT_DEFAULTS.sfUplift,
  sfSlide: DEADWEIGHT_DEFAULTS.sfSlide
};

export interface RaftOptionRow {
  name: string;
  /** This raft uses trial inputs from Tab 2 that differ from the frozen design. */
  isTrial: boolean;
  shoreCount: number;
  bedCount: number;
  tension_kN: number;
  bedCableAngle_deg: number;
  shorePile: { side_m: number; length_m: number; volume_m3: number };
  bedPile: { side_m: number; length_m: number; volume_m3: number };
  block: DeadweightResult;
  /** Units one bed anchor is split into so the crane can place it. */
  liftsPerBlock: number;
}

export interface CostBreakdown {
  concrete_m3: number;
  steel_t: number;
  formwork_m2: number;
  /** Concrete + steel + formwork, VND. */
  material_vnd: number;
  /** Driving / placing on water, VND. */
  installation_vnd: number;
  total_vnd: number;
}

export interface OptionComparison {
  rows: RaftOptionRow[];
  shoreCount: number;
  bedCount: number;
  /** The 129 shore piles — identical in both options. */
  shorePiles: CostBreakdown;
  /** PA1: the lake-bed piles. */
  pa1Bed: CostBreakdown;
  /** PA2: the lake-bed gravity blocks. */
  pa2Bed: CostBreakdown;
  pa1Total_vnd: number;
  pa2Total_vnd: number;
  /** PA2 − PA1 (positive: the piles are cheaper). */
  delta_vnd: number;
  cheaper: MooringOption | 'EQUAL';
  blockMassMin_t: number;
  blockMassMax_t: number;
  /** Bed anchors heavier than the crane capacity, and the total number of crane lifts. */
  blocksOverCrane: number;
  totalLifts: number;
  allBlocksOk: boolean;
}

const breakdown = (
  concrete_m3: number,
  formwork_m2: number,
  steel_kg_m3: number,
  installation_vnd: number,
  c: CostInputs
): CostBreakdown => {
  const steel_kg = concrete_m3 * steel_kg_m3;
  const material = concrete_m3 * c.concrete_vnd_m3 + steel_kg * c.steel_vnd_kg + formwork_m2 * c.formwork_vnd_m2;
  return {
    concrete_m3,
    steel_t: steel_kg / 1000,
    formwork_m2,
    material_vnd: material,
    installation_vnd,
    total_vnd: material + installation_vnd
  };
};

export function compareMooringOptions(
  current: ProjectState,
  activeRaftId: number,
  rafts: RaftSummaryItem[],
  defaultAnchor: AnchorInput,
  costs: CostInputs = DEFAULT_COST_INPUTS
): OptionComparison {
  const rows: RaftOptionRow[] = [];
  let shoreVol = 0, shoreForm = 0, shoreN = 0;
  let bedVol = 0, bedForm = 0, bedN = 0;
  let blockVol = 0, blockForm = 0, lifts = 0, over = 0;

  for (const item of rafts) {
    const { state, deviations } = resolveRaftState(current, activeRaftId, item, defaultAnchor);
    const r = calculateProject(state);
    const nShore = state.line.shoreLineCount ?? item.shoreAnchors;
    const nBed = state.line.bedLineCount ?? item.bedAnchors;

    const sSide = state.anchor.shoreD_m, sLen = state.anchor.shoreL_m + (state.anchor.shoreArm_e_m ?? 0);
    const bSide = state.anchor.bed1D_m, bLen = state.anchor.bed1L_m + (state.anchor.bed1Stickup_m ?? 0);
    const sVol = sSide * sSide * sLen, bVol = bSide * bSide * bLen;

    const angle = r.bedCableAngle_deg ?? 0;
    const block = sizeDeadweightBlock({
      tension_kN: r.t_max_intact_kN,
      cableAngle_deg: angle,
      mu: costs.mu,
      sfUplift: costs.sfUplift,
      sfSlide: costs.sfSlide
    });
    const liftsPerBlock = Math.max(1, Math.ceil(block.mass_t / costs.craneCapacity_t - 1e-9));

    shoreN += nShore; shoreVol += nShore * sVol; shoreForm += nShore * 4 * sSide * sLen;
    bedN += nBed; bedVol += nBed * bVol; bedForm += nBed * 4 * bSide * bLen;
    blockVol += nBed * block.volume_m3;
    blockForm += nBed * 4 * block.L_m * block.H_m;
    lifts += nBed * liftsPerBlock;
    if (block.mass_t > costs.craneCapacity_t) over += nBed;

    rows.push({
      name: item.name,
      isTrial: deviations.length > 0,
      shoreCount: nShore,
      bedCount: nBed,
      tension_kN: r.t_max_intact_kN,
      bedCableAngle_deg: angle,
      shorePile: { side_m: sSide, length_m: sLen, volume_m3: sVol },
      bedPile: { side_m: bSide, length_m: bLen, volume_m3: bVol },
      block,
      liftsPerBlock
    });
  }

  const shorePiles = breakdown(shoreVol, shoreForm, costs.pileSteel_kg_m3, shoreN * costs.pileDriving_vnd, costs);
  const pa1Bed = breakdown(bedVol, bedForm, costs.pileSteel_kg_m3, bedN * costs.pileDriving_vnd, costs);
  const pa2Bed = breakdown(blockVol, blockForm, costs.blockSteel_kg_m3, lifts * costs.blockLift_vnd, costs);
  const pa1Total = shorePiles.total_vnd + pa1Bed.total_vnd;
  const pa2Total = shorePiles.total_vnd + pa2Bed.total_vnd;
  const masses = rows.filter((x) => x.bedCount > 0).map((x) => x.block.mass_t);

  return {
    rows,
    shoreCount: shoreN,
    bedCount: bedN,
    shorePiles,
    pa1Bed,
    pa2Bed,
    pa1Total_vnd: pa1Total,
    pa2Total_vnd: pa2Total,
    delta_vnd: pa2Total - pa1Total,
    cheaper: pa1Total < pa2Total ? 'PA1_PILE' : pa2Total < pa1Total ? 'PA2_DEADWEIGHT' : 'EQUAL',
    blockMassMin_t: masses.length ? Math.min(...masses) : 0,
    blockMassMax_t: masses.length ? Math.max(...masses) : 0,
    blocksOverCrane: over,
    totalLifts: lifts,
    allBlocksOk: rows.every((x) => x.block.ok)
  };
}
