export const DEFAULT_AIR_DENSITY = 1.25; // kg/m³
export const DEFAULT_FRESHWATER_DENSITY = 1000.0; // kg/m³
export const DEFAULT_SEAWATER_DENSITY = 1025.0; // kg/m³
export const DEFAULT_STEEL_DENSITY = 7850.0; // kg/m³
export const DEFAULT_CONCRETE_DENSITY = 2400.0; // kg/m³
export const DEFAULT_GRAVITY = 9.81; // m/s²

/**
 * Bulk material density of the mooring line, kg/m³.
 * Used to convert dry unit weight into SUBMERGED unit weight.
 * Applying the steel value to a synthetic rope overstates the submerged
 * weight ~3x, which inflates seabed friction and shortens the required
 * suspended length — an unconservative error, so the material matters.
 */
export const LINE_MATERIAL_DENSITY: Record<string, number> = {
  steel: 7850.0,      // stud-link / studless chain, steel wire rope
  polyester: 1380.0,  // PES / PET rope (the PES-xx cables of this project)
  nylon: 1140.0,      // PA
  polypropylene: 910.0, // PP — positively buoyant in fresh water
  polyethylene: 950.0   // PE (HMPE ~ 970)
};

/** Default line material implied by the line type when none is set explicitly. */
export function defaultLineMaterialDensity(type: 'cable' | 'chain' | 'combo'): number {
  if (type === 'chain') return LINE_MATERIAL_DENSITY.steel;
  if (type === 'combo') return LINE_MATERIAL_DENSITY.steel;
  return LINE_MATERIAL_DENSITY.polyester;
}

/**
 * Submerged unit weight of a line, N/m.
 * w = w_air * g * (1 - rho_water / rho_material)
 * Returns a NEGATIVE value for a positively buoyant line (PP/PE in fresh
 * water): the caller must treat that as "no catenary" rather than clamp it.
 */
export function submergedUnitWeight_N_per_m(
  unitWeightAir_kgpm: number,
  materialDensity_kgpm3: number,
  waterDensity_kgpm3: number,
  gravity: number
): number {
  if (!(materialDensity_kgpm3 > 0)) return 0;
  return unitWeightAir_kgpm * gravity * (1 - waterDensity_kgpm3 / materialDensity_kgpm3);
}

/** Rounds to `dp` decimals. Display boundary only — never inside the calculation chain. */
export function round(value: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

/** Same, but preserves null (for the optional catenary block). */
export function roundOrNull(value: number | null | undefined, dp = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return round(value, dp);
}

// Concrete standard tensile/compressive strength
export const CONCRETE_RB_B25_MPA = 14.5; // MPa

/**
 * Stud-link chain MBL estimator (IACS-consistent)
 * MBL_kN = c * d^2 * (44 - 0.08 * d) / 1000
 * d in mm
 */
export function estimateChainMBL_kN(diameter_mm: number, grade: 'U1' | 'U2' | 'U3' | 'custom'): number {
  const d = Math.max(1, diameter_mm);
  let c = 21.6; // default U2
  if (grade === 'U1') c = 15.1;
  else if (grade === 'U2') c = 21.6;
  else if (grade === 'U3') c = 31.1;

  const mbl = (c * d * d * (44 - 0.08 * d)) / 1000;
  return Math.round(mbl * 10) / 10;
}

/**
 * Chain unit dry weight estimator
 * kg/m ≈ 0.0219 * d^2 (d in mm)
 */
export function estimateChainWeightAir_kgpm(diameter_mm: number): number {
  const d = Math.max(1, diameter_mm);
  return Math.round(0.0219 * d * d * 100) / 100;
}
