/**
 * Head of a bored shore pile and its cable connection: cast collar, cap plate
 * on four anchor bars, padeye, bow shackle.
 *
 * The geometry is a PROPOSED detail, built around the one requirement the
 * pile design imposes: the cable pin sits `attachHeight_m` above the ground
 * (0.1 m — `anchor.shoreArm_e_m`). A taller padeye would raise the bending
 * moment the pile reinforcement was sized for.
 *
 * Every component is then checked for the design pull γ·T (T = the largest
 * tension one shore pile carries; γ = the pile bending load factor):
 * pin bearing, tear-out of the padeye, the padeye weld, the anchor bars
 * (tension from the overturning couple + shear) and their anchorage length.
 * Steel plate SS400 (TCVN 5575:2012 style design strengths), bars CB400-V,
 * concrete B25. It is a preliminary check for the drawing — the fabrication
 * drawing still has to be issued and verified by a structural engineer.
 */

/** Design strengths, MPa. */
const PLATE_F_MPA = 210; // SS400, t ≤ 40 mm: 235 / 1.1 ≈ 210
const PLATE_FV_MPA = 0.58 * PLATE_F_MPA;
const WELD_F_MPA = 180; // fillet weld, E42 electrodes
const BAR_RS_MPA = 350; // CB400-V
const BAR_RSW_MPA = 280; // CB400-V in shear
const RBT_MPA = 1.05; // B25
const G = 9.81;

export interface ShorePileHeadInput {
  /** Largest tension carried by one shore pile, kN (unfactored). */
  tension_kN: number;
  /** Load factor (the pile bending load factor of the project). */
  loadFactor: number;
  /** Pile diameter, m. */
  pileDia_m: number;
  /** Height of the cable pin above the ground required by the pile design, m. */
  attachHeight_m: number;
  /** Minimum breaking load of the heaviest mooring cable on a shore pile, kN (the shackle must not be the weak link). */
  cableMbl_kN?: number;
}

export interface HeadCheck {
  id: string;
  label: string;
  demand: number;
  capacity: number;
  unit: string;
  utilization: number;
  ok: boolean;
}

export interface ShorePileHead {
  designPull_kN: number;
  /** Geometry, mm. */
  pileDia_mm: number;
  pileTopAboveGround_mm: number;
  collarSide_mm: number;
  collarDepth_mm: number;
  plateSide_mm: number;
  plateThk_mm: number;
  padeyeThk_mm: number;
  padeyeWidth_mm: number;
  padeyeHeight_mm: number;
  holeDia_mm: number;
  /** Hole centre above the top of the cap plate, mm. */
  holeAbovePlate_mm: number;
  /** Hole centre above the ground, mm — must not exceed the required attachment height. */
  pinAboveGround_mm: number;
  weldLeg_mm: number;
  anchorBarDia_mm: number;
  anchorBarCount: number;
  /** Side of the square the four anchor bars stand on, mm. */
  anchorBarSpacing_mm: number;
  anchorBarLength_mm: number;
  /** Bow shackle: working load limit, t, and pin diameter, mm. */
  shackleWll_t: number;
  shacklePin_mm: number;
  checks: HeadCheck[];
  ok: boolean;
}

/** Bow shackles (WLL t → pin diameter mm), safety factor 6 on the breaking load. */
const SHACKLES: Array<[number, number]> = [[8.5, 28], [9.5, 32], [12, 35], [13.5, 38], [17, 42], [25, 50]];
const SHACKLE_SF = 6;

const check = (id: string, label: string, demand: number, capacity: number, unit: string): HeadCheck => {
  const utilization = capacity > 0 ? demand / capacity : Infinity;
  return { id, label, demand, capacity, unit, utilization, ok: utilization <= 1 };
};

export function designShorePileHead(input: ShorePileHeadInput): ShorePileHead {
  const P = input.tension_kN * input.loadFactor; // design pull, taken as horizontal at the pin
  const pileDia_mm = Math.round(input.pileDia_m * 1000);
  const e_mm = Math.round(input.attachHeight_m * 1000);

  // Smallest shackle whose WLL covers the working tension and whose breaking load is not below the cable's.
  const need_t = input.tension_kN / G;
  const mblNeed_t = (input.cableMbl_kN ?? 0) / G;
  const [shackleWll_t, shacklePin_mm] = SHACKLES.find(([wll]) => wll >= need_t && wll * SHACKLE_SF >= mblNeed_t) ?? SHACKLES[SHACKLES.length - 1];

  const pileTopAboveGround_mm = 20;
  const plateThk_mm = 20;
  const holeDia_mm = shacklePin_mm + 4;
  // The pin height is fixed by the pile design; what is left above the plate is the padeye's lever arm.
  const holeAbovePlate_mm = Math.max(Math.ceil(holeDia_mm / 2) + 25, e_mm - pileTopAboveGround_mm - plateThk_mm);
  const padeyeThk_mm = 25;
  const padeyeWidth_mm = 200;
  const padeyeHeight_mm = holeAbovePlate_mm + 50;
  const weldLeg_mm = 10;
  const anchorBarDia_mm = 22, anchorBarCount = 4, anchorBarSpacing_mm = 180, anchorBarLength_mm = 600;
  const collarSide_mm = Math.max(400, pileDia_mm + 50), collarDepth_mm = 300;

  // --- checks (N, mm) ---
  const Pn = P * 1000;
  const bearing = (shacklePin_mm * padeyeThk_mm * PLATE_F_MPA) / 1000;
  const edge_mm = padeyeWidth_mm / 2 - holeDia_mm / 2;
  const tearOut = (2 * edge_mm * padeyeThk_mm * PLATE_FV_MPA) / 1000;

  // Fillet weld on both sides of the padeye: shear P and moment P · arm.
  const throat = 0.7 * weldLeg_mm;
  const weldArea = 2 * throat * padeyeWidth_mm;
  const weldW = (2 * throat * padeyeWidth_mm * padeyeWidth_mm) / 6;
  const weldStress = Math.hypot(Pn / weldArea, (Pn * holeAbovePlate_mm) / weldW);

  // Anchor bars: the couple P · (pin above the pile top) on two bars in tension, the shear on all four.
  const armToConcrete_mm = holeAbovePlate_mm + plateThk_mm;
  const barArea = (Math.PI * anchorBarDia_mm * anchorBarDia_mm) / 4;
  const barTension = (Pn * armToConcrete_mm) / anchorBarSpacing_mm / 2 / 1000; // kN per bar
  const barShear = P / anchorBarCount;
  const barTensionCap = (barArea * BAR_RS_MPA) / 1000;
  const barShearCap = (barArea * BAR_RSW_MPA) / 1000;
  const interaction = (barTension / barTensionCap) ** 2 + (barShear / barShearCap) ** 2;
  // Anchorage (TCVN 5574:2018): l0 = Rs·d / (4·R_bond), R_bond = 2.5·Rbt; scaled by the stress actually in the bar, not less than 15 d and 200 mm.
  const l0 = (BAR_RS_MPA * anchorBarDia_mm) / (4 * 2.5 * RBT_MPA);
  const lAn = Math.max(l0 * (barTension / barTensionCap), 15 * anchorBarDia_mm, 200);

  const pinAboveGround_mm = pileTopAboveGround_mm + plateThk_mm + holeAbovePlate_mm;
  const checks: HeadCheck[] = [
    check('H-1', 'Ma-ní: tải làm việc WLL', need_t, shackleWll_t, 't'),
    check('H-2', 'Ma-ní không yếu hơn cáp: MBL cáp / MBL ma-ní', mblNeed_t, shackleWll_t * SHACKLE_SF, 't'),
    check('H-3', 'Tai neo: ép mặt tại chốt', P, bearing, 'kN'),
    check('H-4', 'Tai neo: cắt xé mép lỗ', P, tearOut, 'kN'),
    check('H-5', 'Đường hàn góc tai neo – bản mã', weldStress, WELD_F_MPA, 'MPa'),
    check('H-6', 'Thép neo bản mã: kéo + cắt (tương tác)', interaction, 1, '-'),
    check('H-7', 'Chiều dài neo thép vào bê tông', lAn, anchorBarLength_mm, 'mm'),
    check('H-8', 'Cao độ chốt cáp so với yêu cầu thiết kế cọc', pinAboveGround_mm, e_mm, 'mm')
  ];

  return {
    designPull_kN: P,
    pileDia_mm, pileTopAboveGround_mm, collarSide_mm, collarDepth_mm,
    plateSide_mm: collarSide_mm, plateThk_mm,
    padeyeThk_mm, padeyeWidth_mm, padeyeHeight_mm, holeDia_mm, holeAbovePlate_mm, pinAboveGround_mm,
    weldLeg_mm, anchorBarDia_mm, anchorBarCount, anchorBarSpacing_mm, anchorBarLength_mm,
    shackleWll_t, shacklePin_mm,
    checks,
    ok: checks.every((c) => c.ok)
  };
}
