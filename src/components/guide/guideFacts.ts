import { calculateProject } from '../../lib/calc';
import { buildRaftProjectState } from '../../lib/calc/raftState';
import type { CalcResults, CheckItem } from '../../lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../data/huoiVanhProject';
import { LAYOUT_COUNTS } from '../../data/huoiVanhLayout';
import { ACTIVE_LAKE } from '../../data/lakes';
import { buildCableCuttingSchedule, SHORT_SHORE_SPAN_M } from '../../lib/io/cableCuttingSchedule';

/**
 * The numbers the Guide page quotes, taken from the current design of the
 * active lake (owner 2026-10-29: the page still spoke of the old 9-raft plan).
 * Nothing here is typed by hand, so the page follows every new layout.
 */
export interface GuideFacts {
  rafts: string[];
  counts: typeof LAYOUT_COUNTS;
  levels: { mnc: number; mndb: number; mnlkt: number };
  tilt_deg: number;
  wind_ms: number;
  panelArea_m2: number;
  adjustStep_m: number;
  cut: {
    bed: Stat; shore: Stat;
    bedGovernedHigh: number; shoreGovernedLow: number;
    shortShore: number; shortShoreRafts: string[];
  };
  example: Example;
}

interface Range { min: number; max: number; med: number }
interface Stat {
  count: number;
  span: Range; chordLow: Range; chordNormal: Range; chordHigh: Range; change: Range;
  slackLow: Range; slackNormal: Range; slackHigh: Range; slopeHigh: Range; pin: Range;
}

export interface Example {
  raft: string;
  panels: number;
  q_Pa: number;
  fPanel_kN: number;
  fFloat_kN: number;
  fEnv_kN: number;
  eq_kN: number;
  pretension_kN: number;
  floor_kN: number;
  t_kN: number;
  tDamaged_kN: number;
  cable: string;
  mbl_kN: number;
  check: (id: string) => CheckItem | undefined;
  results: CalcResults;
  shorePile: { D_mm: number; L_m: number; cage: string; cu_kPa: number; pLateral_kN: number; pMoment_kN: number };
  base?: { side_m: number; thickness_m: number; screws: number; screwL_m: number; cu_kPa: number };
}

const range = (a: number[]): Range => {
  const s = [...a].sort((x, y) => x - y);
  return { min: s[0] ?? 0, max: s[s.length - 1] ?? 0, med: s[Math.floor(s.length / 2)] ?? 0 };
};

export function buildGuideFacts(): GuideFacts {
  const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as typeof HUOI_VANH_DEFAULT_PROJECT;
  const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const cut = buildCableCuttingSchedule(state);
  const stat = (type: 'SHORE' | 'BED'): Stat => {
    const r = cut.rows.filter((q) => q.type === type);
    return {
      count: r.length,
      span: range(r.map((q) => q.span_m)),
      chordLow: range(r.map((q) => q.chordLow_m)), chordNormal: range(r.map((q) => q.chordNormal_m)), chordHigh: range(r.map((q) => q.chordHigh_m)),
      change: range(r.map((q) => Math.max(q.chordLow_m, q.chordNormal_m, q.chordHigh_m) - Math.min(q.chordLow_m, q.chordNormal_m, q.chordHigh_m))),
      slackLow: range(r.map((q) => q.slackLow_m)), slackNormal: range(r.map((q) => q.slackNormal_m)), slackHigh: range(r.map((q) => q.slackHigh_m)),
      slopeHigh: range(r.map((q) => q.slopeHigh_deg)), pin: range(r.map((q) => q.pinLevel_m))
    };
  };
  const shortRows = cut.rows.filter((q) => q.type === 'SHORE' && q.span_m < SHORT_SHORE_SPAN_M);

  // Worked example: the smallest raft that has both shore piles and lake-bed bases.
  const withBed = HUOI_VANH_RAFTS.filter((r) => r.bedAnchors > 0 && r.shoreAnchors > 0);
  const raft = [...(withBed.length ? withBed : HUOI_VANH_RAFTS)].sort((a, b) => a.area_m2 - b.area_m2)[0];
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  const res = calculateProject(st);
  const T0 = st.line.pretension_kN ?? 5;
  const fEnv = res.f_env_total_kN;
  const sb = res.bedScrewBase;
  const example: Example = {
    raft: raft.name,
    panels: st.raft.solarPanelCount ?? 0,
    q_Pa: res.q_wind_Pa,
    fPanel_kN: res.f_wind_panel_kN ?? 0,
    fFloat_kN: res.f_wind_float_kN ?? 0,
    fEnv_kN: fEnv,
    eq_kN: res.mooringAnalysis?.governing.maxTension_kN ?? 0,
    pretension_kN: T0,
    floor_kN: fEnv / (6 * Math.cos(Math.PI / 6)),
    t_kN: res.t_max_intact_kN,
    tDamaged_kN: res.t_max_damaged_kN,
    cable: st.line.cableCode ?? '',
    mbl_kN: st.line.mbl_kN,
    check: (id) => res.checks.find((c) => c.id === id),
    results: res,
    shorePile: {
      D_mm: Math.round(st.anchor.shoreD_m * 1000),
      L_m: st.anchor.shoreL_m,
      cage: `${st.anchor.shoreRebarCount ?? 0}Φ${st.anchor.shoreRebarDia_mm ?? 0}`,
      cu_kPa: st.anchor.cuShore_kPa ?? 40,
      pLateral_kN: res.shorePileCapacity?.Pmax_lateral_kN ?? 0,
      pMoment_kN: res.shorePileCapacity?.Pmax_moment_kN ?? 0
    },
    base: sb ? { side_m: sb.side_m, thickness_m: sb.thickness_m, screws: sb.params.screwCount, screwL_m: sb.params.screwLength_m, cu_kPa: sb.params.cuSurface_kPa } : undefined
  };

  return {
    rafts: HUOI_VANH_RAFTS.map((r) => r.name),
    counts: LAYOUT_COUNTS,
    levels: { mnc: ACTIVE_LAKE.levels.mnc_m, mndb: ACTIVE_LAKE.levels.mndb_m, mnlkt: ACTIVE_LAKE.levels.mnlkt_m },
    tilt_deg: st.raft.solarTilt_deg ?? 10,
    wind_ms: st.env.windSpeed_ms,
    panelArea_m2: st.raft.solarPanelArea_m2 ?? 0,
    adjustStep_m: st.line.adjustStep_m ?? 0,
    cut: {
      bed: stat('BED'), shore: stat('SHORE'),
      bedGovernedHigh: cut.rows.filter((q) => q.type === 'BED' && q.governing === 'MNLKT').length,
      shoreGovernedLow: cut.rows.filter((q) => q.type === 'SHORE' && q.governing === 'MNC').length,
      shortShore: shortRows.length,
      shortShoreRafts: [...new Set(shortRows.map((q) => q.raft))]
    },
    example
  };
}
