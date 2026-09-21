export interface RaftSummaryItem {
  id: number;
  name: string;
  area_m2: number;
  perimeter_m: number;
  length_m: number;
  width_m: number;
  angle_deg: number;
  solarPanelCount?: number;
  focusFactor: number;
  cableCount: number;
  shoreAnchors: number;
  bedAnchors: number;
  selectedCable: string;
  waterDepth_m: number;
  bedAnchorDist_m: number;
  shoreAnchorDist_m: number;
  /**
   * Per-raft Broms pile overrides. Omit to keep the project-default pile
   * (shore D0.45/L6.5, bed D0.35/L8.0 — sized for the small/medium rafts).
   * The large rafts (higher line tension) need a bigger pile so BP-1..BP-5
   * clear their utilization <= 1.0 threshold; see .agentsroom memory
   * `features/mooring-calculation` for the Broms formula this feeds.
   */
  shorePileD_m?: number;
  shorePileL_m?: number;
  bedPileD_m?: number;
  bedPileL_m?: number;
}

export interface MooringCoordinate {
  raft: string;
  code: string;
  type: 'SHORE' | 'BED';
  xRaft: number;
  yRaft: number;
  xAnchor: number;
  yAnchor: number;
  zAnchor: number;
  span: number;
  azimuth: number;
}

/**
 * The 12 raft clusters of Hồ Huổi Vanh — BÈ 1 .. BÈ 12, matching the client's
 * CAD plan one-for-one (there is NO "BÈ 13": the drawing has exactly 12
 * clusters, and cluster 8 merges the two old survey groups 8 and 9).
 *
 * `area_m2` and `perimeter_m` are measured from the surveyed boundary
 * polygons in `huoiVanhRaftPolygons.json` (layer A-DETL-THIN of the client
 * DXF). `length_m`/`width_m` remain the design-table values — they feed the
 * wind/current areas in loads.ts, so they are NOT re-derived from the polygon
 * here; see the project memory note `features/mooring-calculation`.
 */
export const HUOI_VANH_RAFTS: RaftSummaryItem[] = [
  {
    id: 1,
    name: "BÈ 1",
    area_m2: 3732,
    perimeter_m: 266.6,
    length_m: 93.1,
    width_m: 42.1,
    angle_deg: 144,
    solarPanelCount: 834,
    focusFactor: 0.276,
    cableCount: 21,
    shoreAnchors: 17,
    bedAnchors: 4,
    selectedCable: "PES-28",
    waterDepth_m: 6,
    bedAnchorDist_m: 13.5,
    shoreAnchorDist_m: 20
  },
  {
    id: 2,
    name: "BÈ 2",
    area_m2: 4235,
    perimeter_m: 294.5,
    length_m: 88.7,
    width_m: 56,
    angle_deg: 140.7,
    solarPanelCount: 910,
    focusFactor: 0.282,
    cableCount: 20,
    shoreAnchors: 10,
    bedAnchors: 10,
    selectedCable: "PES-28",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20
  },
  {
    id: 3,
    name: "BÈ 3",
    area_m2: 5433,
    perimeter_m: 309.2,
    length_m: 90.5,
    width_m: 61.5,
    angle_deg: 113,
    solarPanelCount: 1093,
    focusFactor: 0.327,
    cableCount: 20,
    shoreAnchors: 11,
    bedAnchors: 9,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.4,
    bedPileL_m: 9
  },
  {
    id: 4,
    name: "BÈ 4",
    area_m2: 6417,
    perimeter_m: 368.6,
    length_m: 107.1,
    width_m: 69.6,
    angle_deg: 90,
    solarPanelCount: 1224,
    focusFactor: 0.31,
    cableCount: 25,
    shoreAnchors: 7,
    bedAnchors: 18,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.4,
    bedPileL_m: 9
  },
  {
    id: 5,
    name: "BÈ 5",
    area_m2: 18814,
    perimeter_m: 555.4,
    length_m: 156.9,
    width_m: 117,
    angle_deg: 90,
    solarPanelCount: 4100,
    focusFactor: 0.102,
    cableCount: 50,
    shoreAnchors: 12,
    bedAnchors: 38,
    selectedCable: "PES-48",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    shorePileD_m: 0.6,
    shorePileL_m: 8,
    bedPileD_m: 0.6,
    bedPileL_m: 12.5
  },
  {
    id: 6,
    name: "BÈ 6",
    area_m2: 8652,
    perimeter_m: 377.8,
    length_m: 107.2,
    width_m: 95.1,
    angle_deg: 0,
    solarPanelCount: 1929,
    focusFactor: 0.206,
    cableCount: 28,
    shoreAnchors: 4,
    bedAnchors: 24,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.4,
    bedPileL_m: 10
  },
  {
    id: 7,
    name: "BÈ 7",
    area_m2: 7283,
    perimeter_m: 396.5,
    length_m: 101.1,
    width_m: 84.8,
    angle_deg: 0,
    solarPanelCount: 1456,
    focusFactor: 0.27,
    cableCount: 26,
    shoreAnchors: 7,
    bedAnchors: 19,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.45,
    bedPileL_m: 10.5
  },
  {
    // Cụm bè số 8 trên bản vẽ (polygon 8.486 m²) gộp hai cụm khảo sát cũ "BÈ 8"
    // (13 dây) và "BÈ 9" (15 dây) thành MỘT bè — xác nhận bằng kiểm tra
    // point-in-polygon: toàn bộ điểm neo của cả hai cụm cũ nằm trong cùng một
    // polygon. Số dây 28 = 13 + 15 (bờ 16 = 7 + 9, đáy 12 = 6 + 6) lấy trực tiếp
    // từ huoiVanhCoordinates.json.
    id: 8,
    name: "BÈ 8",
    area_m2: 8486,
    perimeter_m: 397,
    length_m: 110.5,
    width_m: 79.3,
    angle_deg: 16,
    solarPanelCount: 1800,
    focusFactor: 0.2,
    cableCount: 28,
    shoreAnchors: 16,
    bedAnchors: 12,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.4,
    bedPileL_m: 9.5
  },
  {
    id: 9,
    name: "BÈ 9",
    area_m2: 11627,
    perimeter_m: 470.1,
    length_m: 145.5,
    width_m: 89.3,
    angle_deg: 90,
    solarPanelCount: 2550,
    focusFactor: 0.169,
    cableCount: 32,
    shoreAnchors: 18,
    bedAnchors: 14,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    shorePileD_m: 0.48,
    shorePileL_m: 6.5,
    bedPileD_m: 0.45,
    bedPileL_m: 10.5
  },
  {
    id: 10,
    name: "BÈ 10",
    area_m2: 9110,
    perimeter_m: 397.9,
    length_m: 106.7,
    width_m: 94.1,
    angle_deg: 90,
    solarPanelCount: 1940,
    focusFactor: 0.18,
    cableCount: 27,
    shoreAnchors: 11,
    bedAnchors: 16,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20,
    bedPileD_m: 0.4,
    bedPileL_m: 9
  },
  {
    id: 11,
    name: "BÈ 11",
    area_m2: 4316,
    perimeter_m: 263.8,
    length_m: 70,
    width_m: 58.3,
    angle_deg: 0,
    solarPanelCount: 920,
    focusFactor: 0.3,
    cableCount: 18,
    shoreAnchors: 9,
    bedAnchors: 9,
    selectedCable: "PES-28",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20
  },
  {
    id: 12,
    name: "BÈ 12",
    area_m2: 3926,
    perimeter_m: 283.5,
    length_m: 100.1,
    width_m: 36.2,
    angle_deg: 64,
    solarPanelCount: 770,
    focusFactor: 0.327,
    cableCount: 19,
    shoreAnchors: 14,
    bedAnchors: 5,
    selectedCable: "PES-28",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 15,
    shoreAnchorDist_m: 20
  }
];

export const HUOI_VANH_DEFAULT_PROJECT = {
  id: 'huoi-vanh-fpv',
  name: 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh',
  code: 'HV-FPV-2026',
  location: 'Hồ Huổi Vanh, Tỉnh Điện Biên',
  designer: 'Kỹ sư Kết cấu Thủy công & Năng lượng tái tạo',
  date: '2026-08-19',
  note: 'Tính toán hệ thống neo 12 cụm bè pin nổi (BÈ 1 đến BÈ 12 theo bản vẽ CAD của khách hàng, tổng 19.188 tấm pin, 92.031 m²), cáp neo Polyester PES-24/28/32/36/48 và hệ cọc neo BTCT (cọc bờ D0.45m ngàm 6.5m và cọc đáy D0.35m ngàm 8.0m theo Broms, một số bè lớn dùng cọc tăng cường).',
  systemType: 'solar_fpv' as const,
  activeRaftId: 1,
  meta: {
    name: 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh',
    code: 'HV-FPV-2026',
    location: 'Hồ Huổi Vanh, Tỉnh Điện Biên',
    designer: 'Kỹ sư Kết cấu Thủy công',
    date: '2026-08-19',
    note: 'Hồ chứa nước Huổi Vanh — Hệ neo 12 bè pin mặt trời nổi (BÈ 1 đến BÈ 12)'
  },
  raft: {
    length_m: 90.0,
    width_m: 41.0,
    draft_m: 0.2,
    freeboardHeight_m: 0.35,
    displacement_t: 120.0,
    solarPanelCount: 790,
    solarPanelArea_m2: 2.701,
    solarTilt_deg: 12.0,
    solarShieldFactor: 0.55,
    cdPanel: 1.3,
    cdFloat: 1.1,
    windAreaOverride_m2: 0,
    currentAreaOverride_m2: 0,
    southDist_m: 17.1,
    northDist_m: 33.2,
    eastDist_m: 44.2,
    westDist_m: 27.0
  },
  env: {
    mndbt_m: 383.0,
    mncn_m: 384.0,
    maxDepth_m: 6.2,
    minWaterDepthUnderRaft_m: 1.5,
    bankSlope_m: 3.1,
    waterDepth_m: 6.0,
    tideRange_m: 1.0,
    windSpeed_ms: 30.0,
    windCd: 1.3,
    currentSpeed_ms: 0.5,
    currentCd: 1.2,
    waveHs_m: 0.2,
    waveTp_s: 2.0,
    waveCd: 1.0,
    waveCurrentFactor: 1.05,
    combinationFactor: 1.0,
    airDensity: 1.25,
    waterDensity: 1000.0,
    gravity: 9.81
  },
  line: {
    count: 20,
    longSideCount: 6,
    shortSideCount: 4,
    shoreLineCount: 16,
    bedLineCount: 4,
    effectiveCount: 6,
    horizontalAngle_deg: 30.0,
    type: 'cable' as const,
    cableCode: 'PES-28',
    chainDiameter_mm: 28,
    chainGrade: 'U2' as const,
    mbl_kN: 235.0,
    unitWeightAir_kgpm: 0.54,
    pretension_kN: 5.0,
    focusFactor: 0.276,
    totalLength_m: 35.0,
    groundedLengthMin_m: 5.0,
    seabedFrictionCoef: 0.8
  },
  anchor: {
    mode: 'pile' as const,
    pileBedType: 'method1' as const,
    soilShore: 'clay' as const,
    soilBed: 'mud' as const,
    soil: 'mud' as const,
    cuShore_kPa: 40.0,
    cuBed_kPa: 20.0,
    sfPile: 2.5,
    sfUplift: 2.0,
    concreteRb_MPa: 14.5,
    shoreArm_e_m: 0.5,
    shoreD_m: 0.45,
    shoreL_m: 6.5,
    bed1Arm_e_m: 0.0,
    bed1D_m: 0.35,
    bed1L_m: 8.0,
    bed1Stickup_m: 1.0,
    bed2D_m: 0.70,
    bed2L_m: 9.0,
    anchorType: 'danforth',
    weight_t: 1.5,
    holdingCoef: 8.0,
    frictionCoef: 0.35,
    concreteDensity: 2400.0
  },
  criteria: {
    sfLineIntact: 3.0,
    sfLineDamaged: 2.0,
    sfAnchorIntact: 1.5,
    sfAnchorDamaged: 1.1,
    sfPileLateral: 1.0,
    sfPileUplift: 1.0,
    sfPileSection: 1.0,
    maxLineSpacing_m: 15.0,
    minScopeRatio: 5.0,
    maxOffset_m: 1.0
  },
  attachments: [
    {
      id: 'doc_huoi_vanh_pdf',
      name: 'bố trí bè pin hồ Huổi Vanh.pdf',
      mime: 'application/pdf',
      size: 1277013,
      kind: 'pdf' as const,
      remoteUrl: '/docs_huoi_vanh/bố trí bè pin hồ Huổi Vanh.pdf'
    },
    {
      id: 'doc_huoi_vanh_xlsx',
      name: 'BANG_TINH_NEO_RUT_GON_1_v2.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 618438,
      kind: 'other' as const,
      remoteUrl: '/docs_huoi_vanh/BANG_TINH_NEO_RUT_GON_1_v2.xlsx'
    },
    {
      id: 'doc_huoi_vanh_img',
      name: 'ANH1.jpg',
      mime: 'image/jpeg',
      size: 132274401,
      kind: 'image' as const,
      remoteUrl: '/docs_huoi_vanh/ANH1.jpg'
    }
  ],
  raftsSummary: HUOI_VANH_RAFTS
};
