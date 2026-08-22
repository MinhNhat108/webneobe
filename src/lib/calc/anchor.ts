import { AnchorInput, EnvInput } from './types';

export interface AnchorResult {
  /** False when the anchor is a pile: holding capacity comes from Broms instead. */
  anchorApplies: boolean;
  anchorNote?: string;
  submergedWeight_t: number | null;
  anchorResistance_kN: number | null;
  totalResistance_kN: number | null;
}

/**
 * Holding capacity of a drag anchor or a deadweight concrete block.
 *
 * Pile anchors return `anchorApplies: false`: their capacity is a Broms
 * lateral/uplift problem, not a holding-coefficient one, and reporting 0 kN
 * would read as "no resistance" instead of "checked elsewhere".
 *
 * Unrounded; rounding happens at the display boundary.
 */
export function calculateAnchor(
  anchor: AnchorInput,
  env: EnvInput,
  frictionResistance_kN: number = 0
): AnchorResult {
  const g = env.gravity ?? 9.81;
  const rho_water = env.waterDensity ?? 1000.0;

  if (anchor.mode === 'pile') {
    return {
      anchorApplies: false,
      anchorNote: 'Neo dạng cọc — sức chịu được kiểm tra theo phương pháp Broms (BP-1…BP-5).',
      submergedWeight_t: null,
      anchorResistance_kN: null,
      totalResistance_kN: null
    };
  }

  const weight_t = anchor.weight_t ?? 0;
  const weight_kg = weight_t * 1000.0;

  if (!(weight_kg > 0)) {
    return {
      anchorApplies: true,
      anchorNote: 'Chưa nhập trọng lượng neo.',
      submergedWeight_t: null,
      anchorResistance_kN: null,
      totalResistance_kN: null
    };
  }

  let r_anchor_N = 0;
  let submergedWeight_t: number | null = null;

  if (anchor.mode === 'drag') {
    // Drag embedment anchor: R = HC * W * g, HC from the anchor/soil table.
    const hc = anchor.holdingCoef ?? 0;
    if (!(hc > 0)) {
      return {
        anchorApplies: true,
        anchorNote: 'Chưa nhập hệ số bám neo (HC).',
        submergedWeight_t: null,
        anchorResistance_kN: null,
        totalResistance_kN: null
      };
    }
    r_anchor_N = hc * weight_kg * g;
  } else {
    // Deadweight block: friction on its SUBMERGED weight.
    const rho_concrete = anchor.concreteDensity ?? 2400.0;
    if (!(rho_concrete > rho_water)) {
      return {
        anchorApplies: true,
        anchorNote: `Khối neo (ρ = ${rho_concrete} kg/m³) không nặng hơn nước — không tạo được lực ma sát đáy.`,
        submergedWeight_t: null,
        anchorResistance_kN: null,
        totalResistance_kN: null
      };
    }
    const w_sub_kg = weight_kg * (1.0 - rho_water / rho_concrete);
    submergedWeight_t = w_sub_kg / 1000.0;
    const mu = anchor.frictionCoef ?? 0;
    if (!(mu > 0)) {
      return {
        anchorApplies: true,
        anchorNote: 'Chưa nhập hệ số ma sát đáy (μ) của khối neo.',
        submergedWeight_t,
        anchorResistance_kN: null,
        totalResistance_kN: null
      };
    }
    r_anchor_N = mu * w_sub_kg * g;
  }

  const r_anchor_kN = r_anchor_N / 1000.0;

  return {
    anchorApplies: true,
    submergedWeight_t,
    anchorResistance_kN: r_anchor_kN,
    totalResistance_kN: r_anchor_kN + (frictionResistance_kN || 0)
  };
}
