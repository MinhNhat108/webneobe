/**
 * The wind the project is CALCULATED with against the wind the code asks for.
 *
 * TCVN 2737:2023, wind zone II-B: basic pressure q0 = 0.54 kN/m², i.e.
 * V ≈ 29.7 m/s with ρ = 1.25 kg/m³. Until 2026-10-08 the project default was
 * 30 m/s. The owner then set the DEFAULT to 20 m/s ("tính toán mặc định với
 * gió 20 m/s và để mặc định trên web, còn tùy chỉnh lúc ấy tính sau"): an
 * operating-level wind used to look at an economical first configuration.
 * At 20 m/s the pressure is 0.25 kN/m² and every load is 44 % of the code
 * value, so the anchors sized at the default do NOT hold the code wind.
 *
 * That gap must be visible wherever a result is shown, printed or drawn —
 * this module is the single source of the wording.
 *
 * Hồ Bản Mòng (Sơn La): its TCVN 2737:2023 wind zone has not been looked up
 * yet, so the Huổi Vanh code wind is kept as a PROVISIONAL yardstick and the
 * caveat says so (src/data/lakes.ts, `codeWind.confirmed`).
 */
import { ACTIVE_LAKE } from '../../data/lakes';

export const CODE_WIND_SPEED_MS = ACTIVE_LAKE.codeWind.speed_ms;
/** The wind speed to enter in Tab 2 to check the storm case. */
export const STORM_CHECK_WIND_MS = 30;

export const isBelowCodeWind = (windSpeed_ms: number | undefined): boolean =>
  Number.isFinite(windSpeed_ms) && (windSpeed_ms as number) < CODE_WIND_SPEED_MS - 1e-9;

/** Wind pressure relative to the code pressure, e.g. 0.45 at 20 m/s. */
export const windPressureRatio = (windSpeed_ms: number): number => (windSpeed_ms / CODE_WIND_SPEED_MS) ** 2;

/** The caveat to show when the calculation wind is under the code wind; null otherwise. */
export function designWindCaveat(windSpeed_ms: number | undefined): string | null {
  if (!isBelowCodeWind(windSpeed_ms)) return null;
  const v = windSpeed_ms as number;
  const vn = (x: number, d: number) => x.toFixed(d).replace('.', ',');
  return (
    `Gió tính toán V = ${vn(v, v % 1 === 0 ? 0 : 1)} m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng ${ACTIVE_LAKE.codeWind.zone} ` +
    (ACTIVE_LAKE.codeWind.confirmed ? '' : `(MỐC TẠM lấy theo Huổi Vanh — vùng gió của ${ACTIVE_LAKE.name} chưa tra cứu) `) +
    `(V ≈ ${vn(CODE_WIND_SPEED_MS, 1)} m/s, q0 = ${vn(ACTIVE_LAKE.codeWind.q0_kPa, 2)} kN/m²): áp lực gió chỉ bằng ${Math.round(windPressureRatio(v) * 100)}% mức tiêu chuẩn. ` +
    `Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = ${STORM_CHECK_WIND_MS} m/s ở Tab 2 để kiểm tra.`
  );
}
