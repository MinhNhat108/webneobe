import { LineInput, EnvInput } from './types';
import { defaultLineMaterialDensity, submergedUnitWeight_N_per_m } from './constants';

export interface CatenaryResult {
  /** True when the catenary model applies at all (slack line on the bed). */
  catenaryApplies: boolean;
  /** Why it does not apply, when it does not. */
  catenaryNote?: string;
  materialDensity_kgpm3: number | null;
  submergedWeight_N_per_m: number | null;
  verticalDrop_d_m: number | null;
  suspendedLength_s_m: number | null;
  topTension_kN: number | null;
  topTension_damaged_kN: number | null;
  suspendedProjection_m: number | null;
  groundedLength_m: number | null;
  frictionResistance_kN: number | null;
  lengthDeficit_m: number | null;
  scopeRatio: number | null;
}

const NOT_APPLICABLE = (note: string, extra: Partial<CatenaryResult> = {}): CatenaryResult => ({
  catenaryApplies: false,
  catenaryNote: note,
  materialDensity_kgpm3: null,
  submergedWeight_N_per_m: null,
  verticalDrop_d_m: null,
  suspendedLength_s_m: null,
  topTension_kN: null,
  topTension_damaged_kN: null,
  suspendedProjection_m: null,
  groundedLength_m: null,
  frictionResistance_kN: null,
  lengthDeficit_m: null,
  scopeRatio: null,
  ...extra
});

/**
 * Catenary profile, top tension, suspended length, grounded length and seabed
 * friction of a slack mooring line.
 *
 * Returns `catenaryApplies: false` — not zeros, not garbage — whenever the
 * model does not hold: a taut line to a pile, a positively buoyant rope, or
 * degenerate geometry. Downstream checks turn that into SKIP / NA instead of
 * silently reporting a 343 m suspended length on a 35 m cable.
 *
 * All arithmetic is unrounded; rounding happens at the display boundary.
 */
export function calculateCatenary(
  line: LineInput,
  env: EnvInput,
  h_line_intact_kN: number,
  h_line_damaged_kN: number,
  mooringModel: 'catenary' | 'taut_pile' = 'catenary'
): CatenaryResult {
  const g = env.gravity ?? 9.81;
  const rho_water = env.waterDensity ?? 1000.0;

  const d_m = (env.waterDepth_m ?? 0) + (env.tideRange_m ?? 0);
  const totalLength = line.totalLength_m ?? 0;
  const scopeRatio = d_m > 0 && totalLength > 0 ? totalLength / d_m : null;

  if (mooringModel === 'taut_pile') {
    return NOT_APPLICABLE(
      'Hệ neo căng vào cọc (taut) — không có đoạn dây nằm đáy, không áp dụng mô hình dây xích võng (catenary).',
      { scopeRatio }
    );
  }

  // Submerged unit weight, from the REAL material density of the line.
  const rho_material = line.materialDensity_kgpm3 ?? defaultLineMaterialDensity(line.type);
  const w_air_kgpm = line.unitWeightAir_kgpm ?? 0;
  const w_sub_N = submergedUnitWeight_N_per_m(w_air_kgpm, rho_material, rho_water, g);

  if (w_sub_N <= 0) {
    return NOT_APPLICABLE(
      rho_material > 0 && rho_material <= rho_water
        ? `Vật liệu dây (ρ = ${rho_material} kg/m³) nhẹ hơn nước — dây nổi, không tạo được đường võng catenary.`
        : 'Trọng lượng dây trong nước ≤ 0 — không tính được đường võng catenary.',
      { materialDensity_kgpm3: rho_material, verticalDrop_d_m: d_m > 0 ? d_m : null, scopeRatio }
    );
  }

  const H_intact_N = h_line_intact_kN * 1000.0;
  const H_damaged_N = h_line_damaged_kN * 1000.0;

  if (!(H_intact_N > 0) || !(d_m > 0)) {
    return NOT_APPLICABLE(
      'Thiếu dữ liệu: lực căng ngang hoặc chiều sâu nước ≤ 0.',
      {
        materialDensity_kgpm3: rho_material,
        submergedWeight_N_per_m: w_sub_N,
        verticalDrop_d_m: d_m > 0 ? d_m : null,
        scopeRatio
      }
    );
  }

  // s = sqrt( d * (d + 2H/w) )
  const s_m = Math.sqrt(d_m * (d_m + (2.0 * H_intact_N) / w_sub_N));

  // T_top = H + w * d
  const t_top_intact_N = H_intact_N + w_sub_N * d_m;
  const t_top_damaged_N = H_damaged_N + w_sub_N * d_m;

  // x_susp = (H/w) * asinh( w*s / H )
  const x_susp_m = (H_intact_N / w_sub_N) * Math.asinh((w_sub_N * s_m) / H_intact_N);

  const groundedLength_m = totalLength - s_m;
  const mu_seabed = line.seabedFrictionCoef ?? 0;
  const f_friction_N = mu_seabed * w_sub_N * Math.max(0, groundedLength_m);

  const minGrounded = line.groundedLengthMin_m ?? 0;
  const lengthDeficit_m = Math.max(0, s_m + minGrounded - totalLength);

  return {
    catenaryApplies: true,
    materialDensity_kgpm3: rho_material,
    submergedWeight_N_per_m: w_sub_N,
    verticalDrop_d_m: d_m,
    suspendedLength_s_m: s_m,
    topTension_kN: t_top_intact_N / 1000.0,
    topTension_damaged_kN: t_top_damaged_N / 1000.0,
    suspendedProjection_m: x_susp_m,
    groundedLength_m,
    frictionResistance_kN: f_friction_N / 1000.0,
    lengthDeficit_m,
    scopeRatio
  };
}
