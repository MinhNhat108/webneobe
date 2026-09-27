import { AnchorInput, ProjectState } from './types';
import type { RaftSummaryItem } from '../../data/huoiVanhProject';

/** Minimum breaking load (kN) of the Polyester cables used by the raft catalogue. */
export const CABLE_MBL_KN: Record<string, number> = {
  'PES-48': 688,
  'PES-40': 475,
  'PES-36': 385,
  'PES-32': 305,
  'PES-28': 235
};

/**
 * Builds the per-raft ProjectState override — the SAME logic `setActiveRaft`
 * applies to switch the active raft, factored out so the batch calculator
 * (`calculateAllRafts`) can run it for all 12 rafts without touching
 * `activeRaftId` / `currentProject` in the store.
 */
export function buildRaftProjectState(
  base: ProjectState,
  raftItem: RaftSummaryItem,
  defaultAnchor: AnchorInput
): ProjectState {
  return {
    ...base,
    activeRaftId: raftItem.id,
    meta: {
      ...base.meta,
      note: `Tính toán cho ${raftItem.name} — diện tích ${raftItem.area_m2.toLocaleString()} m², số dây ${raftItem.cableCount} (bờ: ${raftItem.shoreAnchors}, đáy: ${raftItem.bedAnchors})`
    },
    raft: {
      ...base.raft,
      length_m: raftItem.length_m,
      width_m: raftItem.width_m,
      perimeter_m: raftItem.perimeter_m,
      bedCableSpan_m: raftItem.bedAnchorDist_m,
      solarPanelCount: raftItem.solarPanelCount || Math.round(raftItem.area_m2 * 0.22)
    },
    line: {
      ...base.line,
      count: raftItem.cableCount,
      cableCode: raftItem.selectedCable,
      focusFactor: raftItem.focusFactor,
      shoreLineCount: raftItem.shoreAnchors,
      bedLineCount: raftItem.bedAnchors,
      mbl_kN: CABLE_MBL_KN[raftItem.selectedCable] ?? 172
    },
    env: {
      ...base.env,
      waterDepth_m: raftItem.waterDepth_m || 6.0
    },
    anchor: {
      ...base.anchor,
      shoreD_m: raftItem.shorePileD_m ?? defaultAnchor.shoreD_m,
      shoreL_m: raftItem.shorePileL_m ?? defaultAnchor.shoreL_m,
      bed1D_m: raftItem.bedPileD_m ?? defaultAnchor.bed1D_m,
      bed1L_m: raftItem.bedPileL_m ?? defaultAnchor.bed1L_m
    }
  };
}
