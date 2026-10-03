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
  /** Bars on the tension face of the shore / lake-bed pile (one layer) and their diameter, mm. */
  shoreRebarFaceCount?: number;
  shoreRebarDia_mm?: number;
  bedRebarFaceCount?: number;
  bedRebarDia_mm?: number;
  /** Design strength of this raft's pile bars Rs, MPa (omit for the project value). */
  pileRebarRs_MPa?: number;
  /** Piles per shore / lake-bed anchor point (omit for 1). BÈ 5 uses twin piles. */
  shorePilesPerPoint?: number;
  bedPilesPerPoint?: number;
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
 * The 12 raft clusters of Hồ Huổi Vanh — V2 layout (BÈ 1 .. BÈ 12, 90.724 m²;
 * BÈ 5 re-cut to 150 x 109.57 m by the client DXF of 2026-09-27 23:12).
 * Generated from the V2 geometry and the calculation engine; every value is
 * reproducible, none is hand-tuned:
 *
 *  - area_m2 / perimeter_m : the V2 raft outlines (huoiVanhRaftPolygons_v2.json).
 *  - length_m / width_m    : minimum-area bounding rectangle of that outline,
 *    rounded UP to 0.1 m. It feeds the float wind/current areas in loads.ts,
 *    and its area is >= the outline area, so it errs on the loaded side.
 *  - solarPanelCount       : V1 panel density x V2 area, never below the V1
 *    count (a raft that shrank keeps its V1 panel count).
 *  - focusFactor           : the V1 calibration is ff x N ~ 5.1..7.8 per raft
 *    (worst-line share of the load). Where V2 has FEWER lines than V1 it is
 *    scaled by N_V1 / N_V2 (BÈ 1, BÈ 5, BÈ 6); it is never scaled down.
 *  - cableCount / shoreAnchors / bedAnchors : counted from
 *    huoiVanhCoordinates_v2.json (304 lines = 129 shore + 175 bed). Every raft
 *    has N >= ceil(P / 15 m), so C9 holds on all 12; BÈ 5 additionally has
 *    <= 15 m between consecutive cleats along its whole edge.
 *  - bedAnchorDist_m       : the SHORTEST bed line of the raft (floored to
 *    0.1 m). It sets the bed cable inclination atan(depth / span): the
 *    steepest cable, i.e. the largest uplift on the bed pile.
 *  - selectedCable         : smallest PES cable with utilisation <= 0.95,
 *    selected at the earlier 15° tilt (more margin at the present 12°).
 *  - piles (2026-10-03, owner's instruction: 300 or 350 mm square piles only,
 *    longer piles and more reinforcement allowed): every pile is 350 x 350 mm.
 *    L_tk = the previous design depth, or deeper where lateral / uplift need
 *    it (utilisation <= 0.95, Broms FS = 2.5). Reinforcement = the lightest
 *    single layer of bars on the tension face (2..4 bars, D18..D32, CB400-V,
 *    Rs = 350 MPa) with gamma x M_max / M_rd <= 0.95, gamma = 1.2
 *    (TCVN 5574:2018, see pileMrd_kNm in broms.ts).
 *  - BÈ 5 cannot be held by ONE 350 mm pile per line (shore pile over in
 *    bending even with 5 D28 CB500-V; lake-bed pile would need 16 m). By the
 *    owner's decision it has TWIN piles at each of its 39 anchor points: two
 *    350 x 350 mm piles side by side across the cable, >= 3 pile widths apart,
 *    under one yoke. Each pile is checked for T / (2 x 0.9) — see
 *    DEFAULT_PILE_GROUP_EFFICIENCY — and sized like the other rafts.
 *    Project total: 304 anchor points, 343 piles (141 shore + 202 lake-bed).
 */
export const HUOI_VANH_RAFTS: RaftSummaryItem[] = [
  {
    id: 1,
    name: "BÈ 1",
    area_m2: 4122,
    perimeter_m: 276.2,
    length_m: 92.1,
    width_m: 46.1,
    angle_deg: 144,
    solarPanelCount: 922,
    focusFactor: 0.306,
    cableCount: 19,
    shoreAnchors: 14,
    bedAnchors: 5,
    selectedCable: "PES-32",
    waterDepth_m: 6,
    bedAnchorDist_m: 11.6,
    shoreAnchorDist_m: 5.7,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 8.5,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 25,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 20
  },
  {
    id: 2,
    name: "BÈ 2",
    area_m2: 4118,
    perimeter_m: 288,
    length_m: 92,
    width_m: 52.1,
    angle_deg: 140.7,
    solarPanelCount: 910,
    focusFactor: 0.282,
    cableCount: 20,
    shoreAnchors: 10,
    bedAnchors: 10,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 6.4,
    shoreAnchorDist_m: 12.7,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 8,
    shoreRebarFaceCount: 2,
    shoreRebarDia_mm: 28,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 20
  },
  {
    id: 3,
    name: "BÈ 3",
    area_m2: 5584,
    perimeter_m: 312,
    length_m: 92,
    width_m: 64.1,
    angle_deg: 113,
    solarPanelCount: 1124,
    focusFactor: 0.327,
    cableCount: 21,
    shoreAnchors: 11,
    bedAnchors: 10,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 5.6,
    shoreAnchorDist_m: 15.8,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 9,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 28,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 20
  },
  {
    id: 4,
    name: "BÈ 4",
    area_m2: 6878,
    perimeter_m: 370.1,
    length_m: 112.1,
    width_m: 73.1,
    angle_deg: 90,
    solarPanelCount: 1312,
    focusFactor: 0.31,
    cableCount: 25,
    shoreAnchors: 6,
    bedAnchors: 19,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 5.4,
    shoreAnchorDist_m: 16.4,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 9,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 32,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 25
  },
  {
    id: 5,
    name: "BÈ 5",
    area_m2: 16436,
    perimeter_m: 519.1,
    length_m: 150,
    width_m: 109.6,
    angle_deg: 90,
    solarPanelCount: 4100,
    focusFactor: 0.131,
    cableCount: 39,
    shoreAnchors: 12,
    bedAnchors: 27,
    selectedCable: "PES-48",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 9.2,
    shoreAnchorDist_m: 21.2,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 9.5,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 32,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 25,
    // Twin piles at every anchor point (owner's decision, 2026-10-03).
    shorePilesPerPoint: 2,
    bedPilesPerPoint: 2
  },
  {
    id: 6,
    name: "BÈ 6",
    area_m2: 8181,
    perimeter_m: 371.1,
    length_m: 109.6,
    width_m: 76,
    angle_deg: 0,
    solarPanelCount: 1929,
    focusFactor: 0.231,
    cableCount: 25,
    shoreAnchors: 4,
    bedAnchors: 21,
    selectedCable: "PES-40",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 10.1,
    shoreAnchorDist_m: 22.7,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 10,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 32,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 32
  },
  {
    id: 7,
    name: "BÈ 7",
    area_m2: 6868,
    perimeter_m: 388.3,
    length_m: 146.2,
    width_m: 48,
    angle_deg: 0,
    solarPanelCount: 1456,
    focusFactor: 0.27,
    cableCount: 26,
    shoreAnchors: 4,
    bedAnchors: 22,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 10.4,
    shoreAnchorDist_m: 17.8,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 10.5,
    shoreRebarFaceCount: 4,
    shoreRebarDia_mm: 25,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 25
  },
  {
    id: 8,
    name: "BÈ 8",
    area_m2: 9869,
    perimeter_m: 440.4,
    length_m: 112.1,
    width_m: 108.3,
    angle_deg: 16,
    solarPanelCount: 2094,
    focusFactor: 0.2,
    cableCount: 30,
    shoreAnchors: 16,
    bedAnchors: 14,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 9.6,
    shoreAnchorDist_m: 2.6,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 10,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 32,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 25
  },
  {
    id: 9,
    name: "BÈ 9",
    area_m2: 10979,
    perimeter_m: 472.1,
    length_m: 144,
    width_m: 92.1,
    angle_deg: 90,
    solarPanelCount: 2550,
    focusFactor: 0.169,
    cableCount: 32,
    shoreAnchors: 18,
    bedAnchors: 14,
    selectedCable: "PES-40",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 5,
    shoreAnchorDist_m: 13.1,
    shorePileD_m: 0.35,
    shorePileL_m: 7,
    bedPileD_m: 0.35,
    bedPileL_m: 10.5,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 32,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 22
  },
  {
    id: 10,
    name: "BÈ 10",
    area_m2: 9580,
    perimeter_m: 432.5,
    length_m: 108.3,
    width_m: 108,
    angle_deg: 90,
    solarPanelCount: 2041,
    focusFactor: 0.18,
    cableCount: 29,
    shoreAnchors: 11,
    bedAnchors: 18,
    selectedCable: "PES-36",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 8.6,
    shoreAnchorDist_m: 20.3,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 9.5,
    shoreRebarFaceCount: 4,
    shoreRebarDia_mm: 25,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 28
  },
  {
    id: 11,
    name: "BÈ 11",
    area_m2: 4091,
    perimeter_m: 258.1,
    length_m: 73.1,
    width_m: 56,
    angle_deg: 0,
    solarPanelCount: 920,
    focusFactor: 0.3,
    cableCount: 18,
    shoreAnchors: 9,
    bedAnchors: 9,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 8.6,
    shoreAnchorDist_m: 13.6,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 8,
    shoreRebarFaceCount: 4,
    shoreRebarDia_mm: 20,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 22
  },
  {
    id: 12,
    name: "BÈ 12",
    area_m2: 4018,
    perimeter_m: 293,
    length_m: 110,
    width_m: 36.6,
    angle_deg: 64,
    solarPanelCount: 789,
    focusFactor: 0.327,
    cableCount: 20,
    shoreAnchors: 14,
    bedAnchors: 6,
    selectedCable: "PES-32",
    waterDepth_m: 6.2,
    bedAnchorDist_m: 7.2,
    shoreAnchorDist_m: 12.8,
    shorePileD_m: 0.35,
    shorePileL_m: 6.5,
    bedPileD_m: 0.35,
    bedPileL_m: 8,
    shoreRebarFaceCount: 2,
    shoreRebarDia_mm: 28,
    bedRebarFaceCount: 2,
    bedRebarDia_mm: 22
  }
];

export const HUOI_VANH_DEFAULT_PROJECT = {
  id: 'huoi-vanh-fpv',
  name: 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh',
  code: 'HV-FPV-2026',
  location: 'Hồ Huổi Vanh, Tỉnh Điện Biên',
  designer: 'Kỹ sư Kết cấu Thủy công & Năng lượng tái tạo',
  date: '2026-08-19',
  note: 'Tính toán hệ thống neo 12 cụm bè pin nổi V2 (BÈ 1 đến BÈ 12, tổng 90.724 m²), 304 tuyến cáp neo Polyester PES-28/32/36/40/48 và 343 cọc neo VUÔNG BTCT 350×350 tại 304 điểm neo (129 bờ + 175 đáy hồ; BÈ 5 cọc đôi; cốt thép theo TCVN 5574:2018, chiều sâu thiết kế L_tk theo Broms), 12/12 bè đạt C9 (P/N ≤ 15 m).',
  systemType: 'solar_fpv' as const,
  activeRaftId: 1,
  meta: {
    name: 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh',
    code: 'HV-FPV-2026',
    location: 'Hồ Huổi Vanh, Tỉnh Điện Biên',
    designer: 'Kỹ sư Kết cấu Thủy công',
    date: '2026-08-19',
    note: 'Hồ chứa nước Huổi Vanh — Hệ neo 12 bè pin mặt trời nổi V2 (BÈ 1 đến BÈ 12, 343 cọc vuông BTCT 350×350)'
  },
  raft: {
    length_m: 90.0,
    width_m: 41.0,
    draft_m: 0.2,
    freeboardHeight_m: 0.35,
    displacement_t: 120.0,
    solarPanelCount: 790,
    solarPanelArea_m2: 2.701,
    // TCVN 2737:2023 design basis: panel tilt 12.0°, C_d = 1.15.
    solarTilt_deg: 12.0,
    solarShieldFactor: 0.55,
    cdPanel: 1.15,
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
    // Client requirement: every pile is a SQUARE reinforced-concrete pile
    // (cọc vuông BTCT); shoreD_m / bed1D_m are the side of the square.
    shorePileShape: 'square' as const,
    bedPileShape: 'square' as const,
    cuShore_kPa: 40.0,
    cuBed_kPa: 20.0,
    sfPile: 2.5,
    sfUplift: 2.0,
    concreteRb_MPa: 14.5,
    // Pile bending per TCVN 5574:2018: bars on the tension face, design strength
    // Rs (CB400-V), a_s = 50 mm, and a load factor of 1.2 on the wind-governed moment.
    concreteRbt_MPa: 1.05,
    pileRebarRs_MPa: 350,
    pileRebarCover_mm: 50,
    pileBendingLoadFactor: 1.2,
    shoreRebarFaceCount: 3,
    shoreRebarDia_mm: 25,
    bedRebarFaceCount: 3,
    bedRebarDia_mm: 20,
    shoreArm_e_m: 0.5,
    shoreD_m: 0.35,
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
      id: 'doc_huoi_vanh_dxf',
      name: 'HỒ HUỔI VANH.dxf (Bản vẽ CAD mặt bằng 12 bè)',
      mime: 'application/dxf',
      size: 8190634,
      kind: 'dxf' as const,
      remoteUrl: 'docs_huoi_vanh/ho_huoi_vanh.dxf'
    },
    {
      id: 'doc_huoi_vanh_pdf',
      name: 'HOHUOIVANH.Bố trí sơ bộ bè pin.pdf',
      mime: 'application/pdf',
      size: 1438797,
      kind: 'pdf' as const,
      remoteUrl: 'docs_huoi_vanh/HOHUOIVANH_Bo_tri_so_bo_be_pin.pdf'
    },
    {
      id: 'doc_huoi_vanh_xlsx',
      name: 'BANG_TINH_NEO_RUT_GON_1_v2.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 618438,
      kind: 'other' as const,
      remoteUrl: 'docs_huoi_vanh/BANG_TINH_NEO_RUT_GON_1_v2.xlsx'
    },
    {
      id: 'doc_huoi_vanh_img',
      name: 'ANH1.jpg (Ảnh phối cảnh vệ tinh hồ Huổi Vanh)',
      mime: 'image/jpeg',
      size: 1193488,
      kind: 'image' as const,
      remoteUrl: 'docs_huoi_vanh/ANH1_web.jpg'
    },
    {
      id: 'doc_huoi_vanh_docx',
      name: 'THUYET_MINH_TINH_TOAN_KET_QUA_VA_KIEM_TRA_NEO_BE.docx (Thuyết minh phương pháp tính & kiểm tra)',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 15955,
      kind: 'other' as const,
      remoteUrl: 'docs_huoi_vanh/THUYET_MINH_TINH_TOAN_KET_QUA_VA_KIEM_TRA_NEO_BE.docx'
    }
  ],
  raftsSummary: HUOI_VANH_RAFTS
};
