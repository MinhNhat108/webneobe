/**
 * The lakes (projects) the app can show: Hồ Huổi Vanh and Hồ Bản Mòng. The
 * lake is chosen with the tabs in the header and kept in the browser
 * (`mooring_active_lake`); switching reloads the page, so every module-level
 * constant of the data layer (`huoiVanhProject.ts`, `huoiVanhLayout.ts`, the
 * 3D terrain, the water levels) is the ACTIVE lake's for the whole session.
 * The export names of those modules kept their "HUOI_VANH" / "_V2" prefix:
 * they mean "the active lake".
 *
 * Without a browser (vitest, vite-node scripts) the active lake is Huổi Vanh,
 * unless `localStorage` is stubbed before the first import (see
 * src/data/__tests__/banMongLake.test.ts).
 *
 * The levels are pinned equal to scripts/lakeConfig.mjs by lakes.test.ts.
 */
export type LakeId = 'huoi-vanh' | 'ban-mong';

export interface LakeInfo {
  id: LakeId;
  /** "Hồ Huổi Vanh" */
  name: string;
  /** "Huổi Vanh" */
  shortName: string;
  province: string;
  /** Prefix of the ids printed on schedules and drawings (HV-DV001, BM-DV001). */
  codePrefix: string;
  /** Built-in project id of the store. */
  projectId: string;
  /** localStorage key of the store: each lake keeps its own inputs. */
  storageKey: string;
  /** Reservoir levels, project datum (m). */
  levels: { mnc_m: number; mndb_m: number; mnlkt_m: number };
  /** Source of the levels, for the notes. */
  levelsSource: string;
  /** IFC file of the terrain and how its datum relates to the project. */
  ifc: { file: string; datumNote: string };
  /** Code wind the default 20 m/s is compared with (TCVN 2737:2023). */
  codeWind: { zone: string; speed_ms: number; q0_kPa: number; confirmed: boolean };
}

export const LAKES: Record<LakeId, LakeInfo> = {
  'huoi-vanh': {
    id: 'huoi-vanh',
    name: 'Hồ Huổi Vanh',
    shortName: 'Huổi Vanh',
    province: 'Tỉnh Điện Biên',
    codePrefix: 'HV',
    projectId: 'huoi-vanh-fpv',
    storageKey: 'mooring-calc-storage',
    levels: { mnc_m: 380.0, mndb_m: 384.5, mnlkt_m: 386.0 },
    levelsSource: 'Thông số hồ chứa Huổi Vanh',
    ifc: { file: 'dia hinh ho.ifc', datumNote: 'quy đổi cao độ −17,5 m' },
    codeWind: { zone: 'II-B', speed_ms: 29.7, q0_kPa: 0.54, confirmed: true }
  },
  'ban-mong': {
    id: 'ban-mong',
    name: 'Hồ Bản Mòng',
    shortName: 'Bản Mòng',
    province: 'Phường Chiềng Cơi, Tỉnh Sơn La',
    codePrefix: 'BM',
    projectId: 'ban-mong-fpv',
    storageKey: 'mooring-calc-storage-ban-mong',
    // Pre-FS "26.11.10 Pre Fs ĐMT nổi hồ Bản Mòng": MNDBT +662,76; MNLKT (P = 0,2 %) +669,05; MN chết +649,50.
    levels: { mnc_m: 649.5, mndb_m: 662.76, mnlkt_m: 669.05 },
    levelsSource: 'Thông số kỹ thuật hồ Bản Mòng (Pre-FS ĐMT nổi hồ Bản Mòng)',
    ifc: { file: 'CHUGIAP.ifc', datumNote: 'cao độ tuyệt đối, không quy đổi' },
    // Not yet looked up for Sơn La: the Huổi Vanh code wind is kept as the comparison until it is.
    codeWind: { zone: 'II-B', speed_ms: 29.7, q0_kPa: 0.54, confirmed: false }
  }
};

const ACTIVE_KEY = 'mooring_active_lake';

function readActiveLake(): LakeId {
  try {
    const v = globalThis.localStorage?.getItem(ACTIVE_KEY);
    if (v === 'ban-mong' || v === 'huoi-vanh') return v;
  } catch {
    // storage blocked: fall back to the first lake
  }
  return 'huoi-vanh';
}

export const ACTIVE_LAKE_ID: LakeId = readActiveLake();
export const ACTIVE_LAKE: LakeInfo = LAKES[ACTIVE_LAKE_ID];

/** Shows another lake: remembered in the browser, then the page reloads with that lake's data. */
export function switchLake(id: LakeId): void {
  if (id === ACTIVE_LAKE_ID) return;
  try {
    globalThis.localStorage?.setItem(ACTIVE_KEY, id);
  } catch {
    return;
  }
  window.location.reload();
}
