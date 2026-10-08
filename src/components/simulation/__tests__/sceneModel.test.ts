import { describe, it, expect } from 'vitest';
import {
  MNC_M,
  MNDB_M,
  MNLKT_M,
  IFC_DATUM_OFFSET_M,
  IFC_WATER_SURFACE_M,
  SPILL_LEVEL_M,
  groundAt,
  toScene,
  nodeGround,
  nodeX,
  nodeY,
  TERRAIN_NX,
  TERRAIN_NY,
  wetNodes,
  RAFT_MODELS,
  raftWaterline,
  buildPileModels,
  buildCableModels,
  computeRaftMooringStates,
  RAFT_DRAFT_M
} from '../sceneModel';
import { HUOI_VANH_RAFTS, HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { calculateProject } from '../../../lib/calc';
import { buildRaftProjectState } from '../../../lib/calc/raftState';
import type { ProjectState } from '../../../lib/calc/types';

// The project as the app opens it: BÈ 1 active, exactly as designed.
const base = () => {
  const d = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
  return buildRaftProjectState(d, HUOI_VANH_RAFTS[0], d.anchor);
};

describe('Vertical datum — IFC terrain vs project hydrology', () => {
  it('ties the IFC water slab (402.0 m) to MNDB (384.5 m): offset 17.5 m', () => {
    expect(IFC_WATER_SURFACE_M).toBe(402);
    expect(IFC_DATUM_OFFSET_M).toBe(17.5);
  });

  it('puts the water at MNDB on scene y = 0 and the terrain in the same datum', () => {
    expect(toScene(0, 0, MNDB_M).y).toBe(0);
    // Before the fix the terrain was drawn in the IFC datum and the water in
    // the project datum: the lake bed under the rafts sat 11.5 m ABOVE the water.
    for (const r of RAFT_MODELS) {
      const g = groundAt(r.polygon.centroid.x, r.polygon.centroid.y)!;
      expect(toScene(0, 0, g).y, r.name).toBeLessThan(0);
    }
  });

  it('agrees with the calculation: 6 m of water under the rafts, bed piles at the layout bed level', () => {
    const depths = RAFT_MODELS.map((r) => MNDB_M - groundAt(r.polygon.centroid.x, r.polygon.centroid.y)!).sort((a, b) => a - b);
    expect(depths[Math.floor(depths.length / 2)]).toBeCloseTo(6.0, 1); // engine design depth 6.0–6.2 m
    const bedGround = buildPileModels().filter((p) => p.type === 'BED').map((p) => p.ground_m).sort((a, b) => a - b);
    expect(bedGround[0]).toBeCloseTo(378.5, 1); // = the 378.5 m stored for bed piles in the layout
  });
});

describe('Terrain orientation — row 0 is SOUTH', () => {
  it('puts every raft over water at MNDB (a north–south mirror lands rafts on hillsides)', () => {
    for (const r of RAFT_MODELS) {
      const g = groundAt(r.polygon.centroid.x, r.polygon.centroid.y);
      expect(g, r.name).not.toBeNull();
      expect(MNDB_M - g!, r.name).toBeGreaterThan(1);
    }
  });

  it('groundAt reproduces the grid exactly at its nodes', () => {
    // Only nodes whose cell is fully drawn: at the Toposolid's edge the cell is
    // left out, and groundAt deliberately answers only for the drawn surface.
    let checked = 0;
    for (let r = 0; r < TERRAIN_NY - 1; r += 7) {
      for (let c = 0; c < TERRAIN_NX - 1; c += 7) {
        const n = nodeGround(r, c);
        if (n === null || nodeGround(r, c + 1) === null || nodeGround(r + 1, c) === null || nodeGround(r + 1, c + 1) === null) continue;
        expect(groundAt(nodeX(c), nodeY(r))).toBeCloseTo(n, 6);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(TERRAIN_NX * TERRAIN_NY).toBeGreaterThan(10000); // ~9 m cells, not the old 14 m
  });
});

describe('Reservoir water', () => {
  it('fills from the rafts and grows monotonically with the level', () => {
    const count = (l: number) => wetNodes(l).reduce((s, v) => s + v, 0);
    expect(count(378.0)).toBe(0); // below the lake bed: dry
    expect(count(MNC_M)).toBeGreaterThan(0);
    expect(count(MNDB_M)).toBeGreaterThan(count(MNC_M));
    expect(count(MNLKT_M)).toBeGreaterThan(count(MNDB_M));
  });

  it('never pours out of the valley, even above the spill level', () => {
    expect(SPILL_LEVEL_M).toBeGreaterThan(MNLKT_M);
    expect(SPILL_LEVEL_M).toBeLessThan(MNLKT_M + 2);
    const at = (l: number) => wetNodes(l).reduce((s, v) => s + v, 0);
    // Unconstrained, the flood jumps ~1.8x just above the spill; the valley
    // mask keeps a what-if 390 m level within a modest widening of MNLKT.
    expect(at(390) / at(MNLKT_M)).toBeLessThan(1.5);
  });
});

describe('Rafts float, or ground when the water is too low', () => {
  it('8 of the 9 rafts float at MNDB; the east corner of BÈ 6 touches the bank of the IFC terrain', () => {
    // A FINDING about the 2026-10-08 plan, pinned so it is not lost: the terrain under the
    // east corner of BÈ 6 (x = 460.6, y = -27.4) is at the normal water level, i.e. that
    // corner sits on the shoreline. The raft outline must be pulled back or the terrain confirmed.
    expect(RAFT_MODELS).toHaveLength(9);
    expect(RAFT_MODELS.filter((r) => raftWaterline(r, MNDB_M).aground).map((r) => r.name)).toEqual(['BÈ 6']);
    const be6 = RAFT_MODELS.find((r) => r.name === 'BÈ 6')!;
    expect(be6.shallowestGround_m).toBeGreaterThan(MNDB_M - 0.2);
    expect(be6.shallowestGround_m).toBeLessThan(MNDB_M + 0.2);
    for (const r of RAFT_MODELS) expect(raftWaterline(r, MNLKT_M).aground, r.name).toBe(false);
  });

  it('a raft rests on its shallowest ground once the level drops below it', () => {
    const shallowest = [...RAFT_MODELS].sort((a, b) => b.shallowestGround_m - a.shallowestGround_m)[0];
    const low = shallowest.groundingLevel_m - 1;
    const wl = raftWaterline(shallowest, low);
    expect(wl.aground).toBe(true);
    expect(wl.waterline_m).toBeCloseTo(shallowest.shallowestGround_m + RAFT_DRAFT_M, 6);
  });
});

describe('Piles — 265 anchor points for 292 lines, piles embedded by the design L_tk', () => {
  const piles = buildPileModels();

  it('has 214 shore + 51 lake-bed points; 27 lake-bed points hold two lines (shared bases)', () => {
    expect(piles).toHaveLength(265);
    expect(piles.filter((p) => p.type === 'SHORE')).toHaveLength(214);
    expect(piles.filter((p) => p.type === 'BED')).toHaveLength(51);
    expect(piles.filter((p) => p.lines.length === 2)).toHaveLength(27);
    expect(new Set(piles.flatMap((p) => p.lines)).size).toBe(292);
  });

  it('uses each raft\'s design side a and embedment L_tk from the catalogue', () => {
    for (const p of piles) {
      const r = HUOI_VANH_RAFTS.find((x) => x.name === p.raft)!;
      expect(p.side_m, p.code).toBe(p.type === 'SHORE' ? r.shorePileD_m : r.bedPileD_m);
      expect(p.embed_m, p.code).toBe(p.type === 'SHORE' ? r.shorePileL_m : r.bedPileL_m);
    }
  });

  it('stands on the terrain: head = ground + stick-up, toe = ground − L_tk', () => {
    const anchor = HUOI_VANH_DEFAULT_PROJECT.anchor;
    for (const p of piles) {
      expect(p.ground_m, p.code).toBeCloseTo(groundAt(p.x, p.y)!, 9);
      expect(p.head_m - p.ground_m, p.code).toBeCloseTo(p.type === 'SHORE' ? anchor.shoreArm_e_m : anchor.bed1Stickup_m, 9);
      expect(p.ground_m - p.toe_m, p.code).toBeCloseTo(p.embed_m, 9);
    }
  });

  it('follows a change of the stick-up inputs of the calculation', () => {
    const q = buildPileModels({ shoreArm_e_m: 1.2, bed1Stickup_m: 0.4 });
    const shore = q.find((p) => p.type === 'SHORE')!, bed = q.find((p) => p.type === 'BED')!;
    expect(shore.head_m - shore.ground_m).toBeCloseTo(1.2, 9);
    expect(bed.head_m - bed.ground_m).toBeCloseTo(0.4, 9);
  });

  it('cables run from the layout cleat to the head of their own pile', () => {
    const cables = buildCableModels(piles);
    expect(cables).toHaveLength(292);
    for (const c of cables) {
      expect(c.pile.lines, c.code).toContain(c.code);
      expect(c.pile.rafts, c.code).toContain(c.raft);
    }
    // the two cables of a shared base end on the same anchor
    const shared = piles.find((p) => p.lines.length === 2)!;
    expect(cables.filter((c) => c.pile === shared).map((c) => c.code).sort()).toEqual([...shared.lines].sort());
  });
});

describe('Cable and pile colours come from the calculation engine', () => {
  it('reproduces calculateProject for every raft at the design wind', () => {
    const b = base();
    const states = computeRaftMooringStates(b, b.env.windSpeed_ms);
    expect(states.size).toBe(9);
    for (const item of HUOI_VANH_RAFTS) {
      const r = calculateProject(buildRaftProjectState(b, item, b.anchor));
      const st = states.get(item.name)!;
      expect(st.tension_kN).toBe(r.t_max_intact_kN);
      expect(st.safetyFactor).toBeCloseTo(st.mbl_kN / st.tension_kN, 9);
      expect(st.verdict).toBe(r.overallVerdict);
      // D350 bored shore piles and screw-pile bases; the two largest rafts pass with twin shore piles.
      expect(st.verdict, item.name).toBe('PASS');
    }
  });

  it('shows the real safety factor at the default wind (20 m/s): at least 3 on every raft', () => {
    const b = base();
    expect(b.env.windSpeed_ms).toBe(20);
    const states = [...computeRaftMooringStates(b, b.env.windSpeed_ms).values()];
    expect(Math.min(...states.map((s) => s.safetyFactor))).toBeGreaterThan(3);
  });

  it('and shows that the cables chosen at 20 m/s do NOT keep SF 3 at the code wind (29.7 m/s)', () => {
    const states = [...computeRaftMooringStates(base(), 29.7).values()];
    expect(Math.min(...states.map((s) => s.safetyFactor))).toBeLessThan(2);
    expect(states.some((s) => s.verdict === 'FAIL')).toBe(true);
  });

  it('responds to the wind: tension grows with speed', () => {
    const b = base();
    const t = (v: number) => computeRaftMooringStates(b, v).get('BÈ 5A')!.tension_kN;
    expect(t(35)).toBeGreaterThan(t(30));
    expect(t(30)).toBeGreaterThan(t(15));
  });
});

describe('The raft being edited in Tab 2 is simulated with its Tab 2 inputs', () => {
  // BÈ 1 active, cable changed to PES-14 (MBL 60 kN) in Tab 2.
  const trial = (): ProjectState => {
    const b = base();
    return { ...b, line: { ...b.line, cableCode: 'PES-14', mbl_kN: 60 } };
  };

  it('shows no trial flag while every raft is as designed', () => {
    const states = computeRaftMooringStates(base(), 30, 1);
    for (const st of states.values()) expect(st.deviations, st.name).toEqual([]);
    expect(states.get('BÈ 1')!.isActive).toBe(true);
    expect(states.get('BÈ 1')!.cable).toBe(HUOI_VANH_RAFTS[0].selectedCable);
  });

  it('uses the cable chosen in Tab 2 for the active raft, with the real MBL, SF and verdict', () => {
    const p = trial();
    const st = computeRaftMooringStates(p, p.env.windSpeed_ms, 1).get('BÈ 1')!;
    const tab2 = calculateProject(p); // what Tab 2 shows
    expect(st.cable).toBe('PES-14');
    expect(st.mbl_kN).toBe(60);
    expect(st.tension_kN).toBe(tab2.t_max_intact_kN);
    expect(st.safetyFactor).toBeCloseTo(60 / tab2.t_max_intact_kN, 9);
    expect(st.verdict).toBe(tab2.overallVerdict);
    expect(st.verdict).toBe('FAIL');
    expect(st.cableUtil).toBeGreaterThan(1); // drawn red
    expect(st.deviations.map((d) => d.label)).toEqual(expect.arrayContaining(['Loại cáp', 'MBL cáp (kN)']));
  });

  it('keeps the other 8 rafts on the frozen design', () => {
    const p = trial();
    const trialStates = computeRaftMooringStates(p, 30, 1);
    const designStates = computeRaftMooringStates(base(), 30, 1);
    for (const item of HUOI_VANH_RAFTS.slice(1)) {
      const t = trialStates.get(item.name)!, d = designStates.get(item.name)!;
      expect(t.cable, item.name).toBe(item.selectedCable);
      expect(t.tension_kN, item.name).toBe(d.tension_kN);
      expect(t.isActive || t.deviations.length > 0, item.name).toBe(false);
    }
  });

  it('draws the piles of the active raft with the side and L_tk entered in Tab 2, at the same CAD positions', () => {
    const design = buildPileModels();
    const edited = buildPileModels({ shoreD_m: 0.5, shoreL_m: 9.0, bed1D_m: 0.55, bed1L_m: 13.0 }, 'BÈ 1');
    expect(edited).toHaveLength(265);
    edited.forEach((p, i) => {
      expect([p.x, p.y], p.code).toEqual([design[i].x, design[i].y]);
      if (p.raft === 'BÈ 1') {
        expect(p.side_m, p.code).toBe(p.type === 'SHORE' ? 0.5 : 0.55);
        expect(p.embed_m, p.code).toBe(p.type === 'SHORE' ? 9.0 : 13.0);
      } else {
        expect([p.side_m, p.embed_m], p.code).toEqual([design[i].side_m, design[i].embed_m]);
      }
    });
  });
});
