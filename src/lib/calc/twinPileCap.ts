/**
 * Cap of a TWIN shore pile point (Hồ Bản Mòng: two bored D350 piles side by
 * side, perpendicular to the cable, centres `spacingFactor` × D apart; the
 * catalogue checks each pile for T / (2 × group efficiency)).
 *
 * One cable, one padeye: the padeye of the single pile head (shorePileHead.ts,
 * full line tension) stands on a cast-in-place RC beam that ties the two pile
 * heads. The cable pin stays `attachHeight_m` above the ground (the height the
 * pile design assumed), so the cap top is at the ground and the beam is buried.
 *
 * Checks for the design pull P = γ·T, horizontal, at mid-length of the beam
 * (B25, CB400-V, CB240-T; TCVN 5574:2018 simplified, preliminary):
 *  - TC-1 bending in the horizontal plane: the beam spans between the two
 *    piles, M = P·s/4, on the faces facing and away from the cable;
 *  - TC-2 shear V = P/2, concrete alone (0.5·Rbt·b·h0);
 *  - TC-3 torsion: P acts above the beam axis (pin height + half the depth),
 *    T = P·z/2 on each half; closed stirrups for the part above the
 *    cracking torque (thin-tube truss, A0 = core area);
 *  - TC-4 the pile bars reach into the cap: 90° hooks, straight lead 20·d.
 * It is a preliminary member design for the BOQ and the drawing, to be
 * verified by the structural engineer.
 */
import { designShorePileHead, type ShorePileHead, type HeadCheck } from './shorePileHead';

const RBT_MPA = 1.05; // B25
const RS_MPA = 350; // CB400-V
const RSW_MPA = 170; // CB240-T stirrups
const STEEL_KG_M3 = 7850;
const bar_kg_m = (d_mm: number) => (Math.PI * d_mm * d_mm / 4) * 1e-6 * STEEL_KG_M3;

export interface TwinPileCapInput {
  /** Largest tension of the line on this point, kN (unfactored, the WHOLE line). */
  tension_kN: number;
  loadFactor: number;
  pileDia_m: number;
  /** Centre spacing of the two piles in pile diameters (≥ 3). */
  spacingFactor?: number;
  attachHeight_m: number;
  cableMbl_kN?: number;
  /** Main bars of the pile cage, mm (anchored into the cap). */
  pileBarDia_mm: number;
}

export interface TwinPileCap {
  designPull_kN: number;
  /** Beam, mm: length across the cable, width along the cable, depth. */
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  spacing_mm: number;
  /** Bars: per face facing / away from the cable, and the constructive top / bottom bars. */
  faceBars: { count: number; dia_mm: number };
  topBottomBars: { count: number; dia_mm: number };
  stirrup: { dia_mm: number; spacing_mm: number };
  concrete_m3: number;
  steel_kg: number;
  /** The padeye, cap plate and anchor bars on top of the beam (same detail as a single pile head). */
  head: ShorePileHead;
  checks: HeadCheck[];
  ok: boolean;
}

const check = (id: string, label: string, demand: number, capacity: number, unit: string): HeadCheck => {
  const utilization = capacity > 0 ? demand / capacity : Infinity;
  return { id, label, demand, capacity, unit, utilization, ok: utilization <= 1 };
};

export function designTwinPileCap(input: TwinPileCapInput): TwinPileCap {
  const P = input.tension_kN * input.loadFactor;
  const D = Math.round(input.pileDia_m * 1000);
  const spacing_mm = Math.round(Math.max(3, input.spacingFactor ?? 3) * D);
  const cover = 50;
  const width_mm = D + 300; // 150 mm of concrete around the pile in the direction of the pull
  const length_mm = spacing_mm + D + 300;
  const hookLead = 20 * input.pileBarDia_mm;
  // the pile enters 100 mm, its bars need the hooked lead above that, plus cover and the top bars
  const depth_mm = Math.max(600, Math.ceil((100 + hookLead + cover + 20) / 50) * 50);
  const head = designShorePileHead({
    tension_kN: input.tension_kN, loadFactor: input.loadFactor, pileDia_m: input.pileDia_m,
    attachHeight_m: input.attachHeight_m, cableMbl_kN: input.cableMbl_kN
  });

  // TC-1: horizontal bending, the "depth" of the section is the width along the cable
  const M = (P * spacing_mm) / 4 / 1000; // kNm
  const h0 = width_mm - cover - 10;
  const AsReq = (M * 1e6) / (0.9 * h0 * RS_MPA); // mm² on the tension face
  const faceDia = 16;
  const faceCount = Math.max(3, Math.ceil(AsReq / (Math.PI * faceDia * faceDia / 4)));
  const AsProv = faceCount * Math.PI * faceDia * faceDia / 4;
  // TC-2: shear, concrete alone
  const V = P / 2;
  const Vb = 0.5 * RBT_MPA * depth_mm * h0 / 1000;
  // TC-3: torsion, P above the axis of the beam (top of the beam at the ground)
  const z_mm = input.attachHeight_m * 1000 + depth_mm / 2;
  const Tt = (P * z_mm) / 2 / 1000; // kNm, each half
  const bMin = Math.min(width_mm, depth_mm), bMax = Math.max(width_mm, depth_mm);
  const Tcrc = (RBT_MPA * bMin * bMin * bMax / 3) / 1e6 * 0.75; // kNm, plain-concrete cracking torque (rough)
  const A0 = (width_mm - 2 * cover) * (depth_mm - 2 * cover);
  const stirrupDia = 10;
  const AswReq = Tt > Tcrc ? (Tt * 1e6) / (2 * A0 * RSW_MPA) : 0; // mm² per mm of one leg
  const stirrupSpacing = Math.min(150, Math.floor(((Math.PI * stirrupDia * stirrupDia / 4) / Math.max(AswReq, 1e-9)) / 25) * 25);
  // TC-4: hooked pile bars inside the depth
  const leadAvail = depth_mm - 100 - cover - 20;

  const checks: HeadCheck[] = [
    check('TC-1', 'Đài: uốn trong mặt phẳng ngang M = P·s/4 (thép mặt chịu kéo)', AsReq, AsProv, 'mm²'),
    check('TC-2', 'Đài: cắt V = P/2, bê tông chịu', V, Vb, 'kN'),
    check('TC-3', 'Đài: xoắn T = P·z/2 — đai kín', Tt, Tt > Tcrc ? (2 * A0 * RSW_MPA * (Math.PI * stirrupDia * stirrupDia / 4) / stirrupSpacing) / 1e6 : Tcrc, 'kNm'),
    check('TC-4', 'Thép chủ cọc neo vào đài (móc 90°, đoạn thẳng 20d)', hookLead, leadAvail, 'mm'),
    ...head.checks
  ];

  const concrete_m3 = (length_mm * width_mm * depth_mm) / 1e9;
  const barLen = (length_mm - 2 * cover) / 1000;
  const stirrupLen = 2 * ((width_mm - 2 * cover) + (depth_mm - 2 * cover)) / 1000 + 0.2;
  const stirrupN = Math.floor((length_mm - 2 * cover) / stirrupSpacing) + 1;
  const steel_kg = 2 * faceCount * barLen * bar_kg_m(faceDia) + 4 * barLen * bar_kg_m(12) + stirrupN * stirrupLen * bar_kg_m(stirrupDia);

  return {
    designPull_kN: P,
    length_mm, width_mm, depth_mm, spacing_mm,
    faceBars: { count: faceCount, dia_mm: faceDia },
    topBottomBars: { count: 4, dia_mm: 12 },
    stirrup: { dia_mm: stirrupDia, spacing_mm: stirrupSpacing },
    concrete_m3, steel_kg,
    head, checks,
    ok: checks.every((c) => c.ok)
  };
}
