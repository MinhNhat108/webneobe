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

/** A raft-specific input of the active raft that differs from the frozen design catalogue. */
export interface RaftDeviation {
  label: string;
  design: string | number;
  current: string | number;
}

type Section = 'raft' | 'line' | 'env' | 'anchor';
/** The inputs `buildRaftProjectState` sets per raft — everything else is project-wide. */
const RAFT_SPECIFIC_FIELDS: Array<[Section, string, string]> = [
  ['line', 'cableCode', 'Loại cáp'],
  ['line', 'mbl_kN', 'MBL cáp (kN)'],
  ['line', 'count', 'Số dây neo'],
  ['line', 'shoreLineCount', 'Số dây bờ'],
  ['line', 'bedLineCount', 'Số dây đáy'],
  ['line', 'focusFactor', 'Hệ số tập trung'],
  ['raft', 'length_m', 'Chiều dài bè (m)'],
  ['raft', 'width_m', 'Chiều rộng bè (m)'],
  ['raft', 'perimeter_m', 'Chu vi bè (m)'],
  ['raft', 'bedCableSpan_m', 'Nhịp cáp đáy ngắn nhất (m)'],
  ['raft', 'solarPanelCount', 'Số tấm pin'],
  ['env', 'waterDepth_m', 'Độ sâu nước (m)'],
  ['anchor', 'shoreD_m', 'Cạnh cọc bờ a (m)'],
  ['anchor', 'shoreL_m', 'L_tk cọc bờ (m)'],
  ['anchor', 'bed1D_m', 'Cạnh cọc đáy a (m)'],
  ['anchor', 'bed1L_m', 'L_tk cọc đáy (m)']
];

/**
 * How the project being edited (Tab 2) departs from the design catalogue for
 * `raftItem`: only the per-raft inputs are compared, since the project-wide
 * ones (wind, soil, criteria…) apply to all 12 rafts alike.
 */
export function raftDesignDeviations(
  current: ProjectState,
  raftItem: RaftSummaryItem,
  defaultAnchor: AnchorInput
): RaftDeviation[] {
  const design = buildRaftProjectState(current, raftItem, defaultAnchor);
  const out: RaftDeviation[] = [];
  for (const [sec, key, label] of RAFT_SPECIFIC_FIELDS) {
    const d = (design[sec] as unknown as Record<string, unknown>)[key];
    const c = (current[sec] as unknown as Record<string, unknown>)[key];
    if (d === c || (typeof d === 'number' && typeof c === 'number' && Math.abs(d - c) < 1e-9)) continue;
    out.push({ label, design: (d ?? '—') as string | number, current: (c ?? '—') as string | number });
  }
  return out;
}

export interface ResolvedRaftState {
  state: ProjectState;
  /** This raft is the one being edited in Tab 2. */
  isActive: boolean;
  /** Non-empty when the active raft is a trial that differs from the frozen design. */
  deviations: RaftDeviation[];
}

/**
 * The inputs every multi-raft view (3D simulation, layout map, 12-raft table,
 * Excel/CAD exports) must use for one raft: the ACTIVE raft is exactly the
 * project being edited in Tab 2 — its cable, piles etc. included — and every
 * other raft is the frozen design catalogue on top of the same project-wide
 * inputs. One function, so no view can disagree with Tab 2 or with another view.
 */
export function resolveRaftState(
  current: ProjectState,
  activeRaftId: number,
  raftItem: RaftSummaryItem,
  defaultAnchor: AnchorInput
): ResolvedRaftState {
  if (raftItem.id !== activeRaftId) {
    return { state: buildRaftProjectState(current, raftItem, defaultAnchor), isActive: false, deviations: [] };
  }
  return { state: current, isActive: true, deviations: raftDesignDeviations(current, raftItem, defaultAnchor) };
}
