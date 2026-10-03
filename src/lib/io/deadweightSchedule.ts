import { calculateProject } from '../calc';
import type { CalcResults, ProjectState } from '../calc/types';
import type { DeadweightResult } from '../calc/deadweight';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { buildPileSchedule, PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';

/** One lake-bed gravity block of option 2 — a row of the CAD table and of the Excel sheet. */
export interface BlockScheduleRow {
  /** Sequential drawing id, HV-DW001… */
  blockId: string;
  /** Anchor-point code of the layout, e.g. B1-D03. */
  code: string;
  raft: string;
  x: number;
  y: number;
  z: number;
  xRaft: number;
  yRaft: number;
  L_m: number;
  W_m: number;
  H_m: number;
  volume_m3: number;
  /** Mass in air, t. */
  mass_t: number;
  weightSub_kN: number;
  Tmax_kN: number;
  cableAngle_deg: number;
  sfSlide: number;
  sfUplift: number;
  sfOverturn: number;
  qContact_kPa: number;
  qAllow_kPa: number;
  ok: boolean;
  /** Ids of the neighbouring blocks this one physically overlaps on plan (empty when it fits). */
  clashWith: string[];
}

export interface BlockClash {
  a: string;
  b: string;
  /** Centre-to-centre distance, m. */
  distance_m: number;
  /** Clear distance needed for the two bases to fit whatever their orientation: (L_a + L_b) / 2, m. */
  required_m: number;
}

/**
 * Pairs of blocks that cannot both be placed: their centres are closer than
 * the sum of their half-sides, so the bases overlap however they are turned.
 * The anchor points were laid out for piles 0.35–0.60 m wide (some only ~3 m
 * apart on the centre line of a narrow gap between rafts); a block several
 * metres wide does not fit at every one of them.
 */
export function findBlockClashes(blocks: Array<{ id: string; x: number; y: number; L_m: number }>): BlockClash[] {
  const out: BlockClash[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const d = Math.hypot(blocks[i].x - blocks[j].x, blocks[i].y - blocks[j].y);
      const need = (blocks[i].L_m + blocks[j].L_m) / 2;
      if (d < need) out.push({ a: blocks[i].id, b: blocks[j].id, distance_m: d, required_m: need });
    }
  }
  return out;
}

export interface DeadweightSchedule {
  /**
   * The 129 shore piles. They keep the id they have in the option 1 schedule
   * (HV-Pnnn numbered over all 304 anchor points), so one pile never carries
   * two different ids in two drawings.
   */
  shorePiles: PileScheduleRow[];
  /** The 175 lake-bed blocks, HV-DW001… in layout order. */
  blocks: BlockScheduleRow[];
  /** The block of each raft (one size per raft, like the piles). */
  blockByRaft: Map<string, DeadweightResult>;
  /** Blocks that overlap a neighbour at the layout's anchor points. */
  clashes: BlockClash[];
}

/**
 * Option 2 schedule: shore piles from the pile schedule, lake-bed anchors as
 * the gravity block the ENGINE sized for their raft (`results.bedBlock`). When
 * the supplied results were calculated under option 1, the raft is recalculated
 * under option 2 with the same inputs, so the schedule never invents a block.
 */
export function buildDeadweightSchedule(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): DeadweightSchedule {
  const all = buildPileSchedule(state, results, batchResults, coordinates);
  const byRaft = new Map<string, PileScheduleBatchLike>();
  for (const b of batchResults ?? []) byRaft.set(b.raft.name, b);

  const cache = new Map<string, { block: DeadweightResult; res: CalcResults }>();
  const blockOf = (raft: string) => {
    const hit = cache.get(raft);
    if (hit) return hit;
    const batch = byRaft.get(raft);
    let res = batch?.results ?? results;
    if (!res.bedBlock) {
      const st = batch?.state ?? state;
      res = calculateProject({ ...st, anchor: { ...st.anchor, bedAnchorOption: 'PA2_DEADWEIGHT' } });
    }
    if (!res.bedBlock) throw new Error(`Không tính được khối bê tông neo đáy cho ${raft} (thiếu góc cáp đáy).`);
    const out = { block: res.bedBlock, res };
    cache.set(raft, out);
    return out;
  };

  const blocks: BlockScheduleRow[] = [];
  for (const r of all) {
    if (r.type !== 'BED') continue;
    const { block, res } = blockOf(r.raft);
    blocks.push({
      blockId: `HV-DW${String(blocks.length + 1).padStart(3, '0')}`,
      code: r.code,
      raft: r.raft,
      x: r.x,
      y: r.y,
      z: r.z,
      xRaft: r.xRaft,
      yRaft: r.yRaft,
      L_m: block.L_m,
      W_m: block.W_m,
      H_m: block.H_m,
      volume_m3: block.volume_m3,
      mass_t: block.mass_t,
      weightSub_kN: block.weightSub_kN,
      Tmax_kN: res.t_max_intact_kN,
      cableAngle_deg: res.bedCableAngle_deg ?? 0,
      sfSlide: block.sfSlide,
      sfUplift: block.sfUplift,
      sfOverturn: block.sfOverturn,
      qContact_kPa: block.qContact_kPa,
      qAllow_kPa: block.params.qAllow_kPa,
      ok: block.ok,
      clashWith: []
    });
  }

  const clashes = findBlockClashes(blocks.map((b) => ({ id: b.blockId, x: b.x, y: b.y, L_m: Math.max(b.L_m, b.W_m) })));
  const byId = new Map(blocks.map((b) => [b.blockId, b]));
  for (const c of clashes) {
    byId.get(c.a)!.clashWith.push(c.b);
    byId.get(c.b)!.clashWith.push(c.a);
  }

  return {
    shorePiles: all.filter((r) => r.type === 'SHORE'),
    blocks,
    blockByRaft: new Map([...cache].map(([raft, v]) => [raft, v.block])),
    clashes
  };
}
