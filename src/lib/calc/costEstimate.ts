/**
 * Construction quotation: bored shore piles + the lake-bed anchors — driven
 * piles (PA1) or RC bases with screw piles (PA3, the design since 2026-10-08).
 *
 * Quantities are taken from the pile schedule (every pile of every anchor
 * point, full length = L_tk + stick-up), so the quotation can never disagree
 * with the schedule, the Excel sheet or the drawing.
 *
 * The default unit prices are the mid-points of the REFERENCE ranges the owner
 * supplied on 2026-10-04 (market price lists for mini bored piles and for
 * 350 x 350 precast piles driven over water). They are not a contractor's
 * offer and every one of them is editable.
 *
 * Caveat that must stay visible wherever the total is shown: those reference
 * prices are for ordinary commercial piles (the precast list quotes Φ16–Φ20
 * main bars). The piles of this design carry much heavier reinforcement
 * (4Φ20–4Φ32 precast, 4–8 bars Φ25–Φ32 bored), so a real quotation will be
 * higher unless the reinforcement surcharge below is filled in.
 */
import type { PileScheduleRow } from '../io/pileSchedule';

export type BedMaterialPreset = 'mass' | 'standard' | 'prestressed' | 'custom';

export interface CostParams {
  // Bored shore piles
  /** 'turnkey': one all-in price per metre; 'detailed': labour + material per metre. */
  shoreBoredCostMode: 'turnkey' | 'detailed';
  shoreTurnkeyRate_VND_m: number;
  shoreLaborRate_VND_m: number;
  shoreMaterialRate_VND_m: number;
  /** Extra per metre for reinforcement heavier than the reference pile (default 0). */
  shoreRebarSurcharge_VND_m: number;

  // Driven lake-bed piles
  bedMaterialPreset: BedMaterialPreset;
  /** Precast pile at the yard, per metre. */
  bedMaterialRate_VND_m: number;
  /** Driving over water (barge + hammer + crew), per metre. */
  bedDrivingRate_VND_m: number;
  /** Floating platform / barge set-up for the whole campaign. */
  bedBargeSetup_VND: number;
  /** Handling at both ends (truck → bank → barge), % of the pile purchase. */
  bedLogisticsPercent: number;
  /** Extra per metre for reinforcement heavier than the reference pile (default 0). */
  bedRebarSurcharge_VND_m: number;

  // RC bases with screw piles (PA3). NO reference price was supplied for these:
  // they default to 0 and the quotation lists them as "chưa có đơn giá" until entered.
  /** Reinforced concrete of the base, cast and cured (concrete + formwork + labour), per m³. */
  baseConcreteRate_VND_m3: number;
  /** Slab reinforcement, supplied and fixed, per kg. */
  baseRebarRate_VND_kg: number;
  /** Screw pile Ø89×5 with thread, galvanised, supplied, per metre. */
  screwRate_VND_m: number;
  /** Lowering one base to the bed and screwing its piles in (barge crane, divers), per base. */
  baseInstallRate_VND_each: number;

  contingencyPercent: number;
  vatPercent: number;
  includeVat: boolean;
}

/** Reference ranges from the owner's price lists (VND per metre unless noted). */
export const BORED_PILE_PRICE_LIST: Array<{ dia_mm: number; labor: [number, number]; turnkey: [number, number] }> = [
  { dia_mm: 300, labor: [175_000, 250_000], turnkey: [360_000, 435_000] },
  { dia_mm: 350, labor: [260_000, 280_000], turnkey: [460_000, 500_000] },
  { dia_mm: 400, labor: [230_000, 280_000], turnkey: [560_000, 710_000] },
  { dia_mm: 500, labor: [260_000, 320_000], turnkey: [760_000, 810_000] },
  { dia_mm: 600, labor: [300_000, 360_000], turnkey: [950_000, 1_200_000] }
];

export const BED_MATERIAL_PRESETS: Record<Exclude<BedMaterialPreset, 'custom'>, { label: string; range: [number, number]; rate: number }> = {
  mass: { label: 'Cọc đúc sẵn đại trà (thép tổ hợp / Đa Hội, mác 250–300)', range: [250_000, 290_000], rate: 270_000 },
  standard: { label: 'Cọc thương mại tiêu chuẩn (thép Hòa Phát, Việt Đức, mác 300–350)', range: [320_000, 450_000], rate: 380_000 },
  prestressed: { label: 'Cọc vuông ly tâm dự ứng lực cường độ cao', range: [650_000, 1_027_000], rate: 840_000 }
};

/** Reference ranges of the other items, for the notes of the quotation. */
export const COST_REFERENCE = {
  bedDriving: [120_000, 220_000] as [number, number],
  bedBargeSetup: [30_000_000, 70_000_000] as [number, number],
  bedLogisticsPercent: [5, 10] as [number, number]
};

const mid = (r: [number, number]) => (r[0] + r[1]) / 2;
const D350 = BORED_PILE_PRICE_LIST.find((p) => p.dia_mm === 350)!;

export const DEFAULT_COST_PARAMS: CostParams = {
  shoreBoredCostMode: 'turnkey',
  shoreTurnkeyRate_VND_m: mid(D350.turnkey), // 480 000
  shoreLaborRate_VND_m: mid(D350.labor), // 270 000
  shoreMaterialRate_VND_m: mid(D350.turnkey) - mid(D350.labor), // 210 000
  shoreRebarSurcharge_VND_m: 0,
  bedMaterialPreset: 'standard',
  bedMaterialRate_VND_m: BED_MATERIAL_PRESETS.standard.rate, // 380 000
  bedDrivingRate_VND_m: mid(COST_REFERENCE.bedDriving), // 170 000
  bedBargeSetup_VND: mid(COST_REFERENCE.bedBargeSetup), // 50 000 000
  bedLogisticsPercent: 7,
  bedRebarSurcharge_VND_m: 0,
  baseConcreteRate_VND_m3: 0,
  baseRebarRate_VND_kg: 0,
  screwRate_VND_m: 0,
  baseInstallRate_VND_each: 0,
  contingencyPercent: 5,
  vatPercent: 8,
  includeVat: true
};

/** Quantities of the screw-pile bases per raft, from the anchor schedule (a base shared by two rafts counts half for each). */
export interface ScrewBaseQuantities {
  rows: Array<{ name: string; bases: number; concrete_m3: number; rebar_kg: number; screwLength_m: number }>;
}

export interface RaftCostBreakdown {
  raftName: string;
  shorePiles: number;
  shoreMeters: number;
  shoreCost_VND: number;
  bedPiles: number;
  bedMeters: number;
  /** Purchase + driving + logistics + this raft's share of the barge set-up. */
  bedCost_VND: number;
  /** Direct cost of the raft (before contingency and VAT). */
  totalCost_VND: number;
}

export interface CostLine {
  no: string;
  item: string;
  unit: string;
  quantity: number;
  rate: number;
  amount_VND: number;
  note: string;
}

export interface CostEstimateSummary {
  totalShorePiles: number;
  totalShoreMeters: number;
  totalBedPiles: number;
  totalBedMeters: number;
  totalPiles: number;
  totalMeters: number;

  /** Price per metre actually applied to the shore piles (turnkey, or labour + material), plus the surcharge. */
  shoreRate_VND_m: number;
  shoreTotal_VND: number;
  bedMaterialTotal_VND: number;
  bedDrivingTotal_VND: number;
  bedLogisticsTotal_VND: number;
  bedBargeSetup_VND: number;
  bedTotal_VND: number;

  directTotal_VND: number;
  contingency_VND: number;
  /** Direct + contingency. */
  beforeVat_VND: number;
  vat_VND: number;
  grandTotal_VND: number;

  /** What the lake-bed anchors are in this quotation. */
  bedAnchorKind: 'pile' | 'screwBase';
  /** Screw-pile bases (0 when the lake-bed anchors are piles). */
  totalBases: number;
  baseConcrete_m3: number;
  baseRebar_kg: number;
  screwLength_m: number;
  /** Items with a quantity but no unit price yet — the total does NOT include them. */
  unpriced: string[];

  /** Main reinforcement actually designed, kg per metre of pile (for the caveat on the reference prices). */
  shoreMainSteel_kg_m: number;
  bedMainSteel_kg_m: number;

  lines: CostLine[];
  raftBreakdowns: RaftCostBreakdown[];
}

/**
 * @param screw when given, the lake-bed anchors are RC bases with screw piles:
 *   the lake-bed PILE rows of the schedule are ignored and these quantities are priced instead.
 */
export function calculateCostEstimate(rawParams: CostParams, scheduleRows: PileScheduleRow[], screw?: ScrewBaseQuantities): CostEstimateSummary {
  // A quotation saved before the screw-base prices existed has no such keys.
  const params: CostParams = { ...DEFAULT_COST_PARAMS, ...rawParams };
  const shoreRate =
    (params.shoreBoredCostMode === 'turnkey'
      ? params.shoreTurnkeyRate_VND_m
      : params.shoreLaborRate_VND_m + params.shoreMaterialRate_VND_m) + params.shoreRebarSurcharge_VND_m;
  const bedMaterialRate = params.bedMaterialRate_VND_m + params.bedRebarSurcharge_VND_m;
  const logistics = params.bedLogisticsPercent / 100;

  const byRaft = new Map<string, RaftCostBreakdown>();
  let shoreN = 0, shoreM = 0, bedN = 0, bedM = 0, shoreSteel = 0, bedSteel = 0;
  for (const r of scheduleRows) {
    const n = r.pileCount, metres = n * r.Ltotal_m;
    if (!byRaft.has(r.raft)) {
      byRaft.set(r.raft, { raftName: r.raft, shorePiles: 0, shoreMeters: 0, shoreCost_VND: 0, bedPiles: 0, bedMeters: 0, bedCost_VND: 0, totalCost_VND: 0 });
    }
    const b = byRaft.get(r.raft)!;
    if (r.type === 'SHORE') {
      shoreN += n; shoreM += metres; shoreSteel += n * r.cage.mainSteel_kg;
      b.shorePiles += n; b.shoreMeters += metres;
    } else if (!screw) {
      bedN += n; bedM += metres; bedSteel += n * r.cage.mainSteel_kg;
      b.bedPiles += n; b.bedMeters += metres;
    }
  }
  const sq = screw?.rows ?? [];
  const sum = (f: (x: ScrewBaseQuantities['rows'][number]) => number) => sq.reduce((s, x) => s + f(x), 0);
  const bases = sum((x) => x.bases), baseConc = sum((x) => x.concrete_m3), baseSteel = sum((x) => x.rebar_kg), screwM = sum((x) => x.screwLength_m);
  const baseCostOf = (x: ScrewBaseQuantities['rows'][number]) =>
    x.concrete_m3 * params.baseConcreteRate_VND_m3 + x.rebar_kg * params.baseRebarRate_VND_kg +
    x.screwLength_m * params.screwRate_VND_m + x.bases * params.baseInstallRate_VND_each;

  const shoreTotal = shoreM * shoreRate;
  const bedMaterial = bedM * bedMaterialRate;
  const bedDriving = bedM * params.bedDrivingRate_VND_m;
  const bedLogistics = bedMaterial * logistics;
  const bargeSetup = bedN > 0 || bases > 0 ? params.bedBargeSetup_VND : 0;
  const baseTotal = sum(baseCostOf);
  const bedTotal = (screw ? baseTotal : bedMaterial + bedDriving + bedLogistics) + bargeSetup;

  // The barge set-up is a campaign cost: share it by metres of lake-bed pile, or by number of bases.
  for (const x of sq) {
    if (!byRaft.has(x.name)) byRaft.set(x.name, { raftName: x.name, shorePiles: 0, shoreMeters: 0, shoreCost_VND: 0, bedPiles: 0, bedMeters: 0, bedCost_VND: 0, totalCost_VND: 0 });
  }
  for (const b of byRaft.values()) {
    b.shoreCost_VND = b.shoreMeters * shoreRate;
    const own = sq.find((x) => x.name === b.raftName);
    if (screw) {
      b.bedPiles = own?.bases ?? 0;
      b.bedCost_VND = (own ? baseCostOf(own) : 0) + (bases > 0 ? (bargeSetup * (own?.bases ?? 0)) / bases : 0);
    } else {
      b.bedCost_VND =
        b.bedMeters * bedMaterialRate * (1 + logistics) + b.bedMeters * params.bedDrivingRate_VND_m + (bedM > 0 ? (bargeSetup * b.bedMeters) / bedM : 0);
    }
    b.totalCost_VND = b.shoreCost_VND + b.bedCost_VND;
  }

  const direct = shoreTotal + bedTotal;
  const contingency = (direct * params.contingencyPercent) / 100;
  const beforeVat = direct + contingency;
  const vat = params.includeVat ? (beforeVat * params.vatPercent) / 100 : 0;

  const NO_PRICE = 'CHƯA CÓ ĐƠN GIÁ — nhập để tính';
  const baseLines: CostLine[] = [
    { no: 'B.1', item: 'Đế BTCT neo đáy: bê tông B25 đúc sẵn (gồm ván khuôn, lỗ chờ, gờ chống trượt)', unit: 'm³', quantity: baseConc, rate: params.baseConcreteRate_VND_m3, amount_VND: baseConc * params.baseConcreteRate_VND_m3, note: params.baseConcreteRate_VND_m3 > 0 ? `${bases} đế` : NO_PRICE },
    { no: 'B.2', item: 'Đế BTCT neo đáy: cốt thép lưới 2 lớp', unit: 'kg', quantity: baseSteel, rate: params.baseRebarRate_VND_kg, amount_VND: baseSteel * params.baseRebarRate_VND_kg, note: params.baseRebarRate_VND_kg > 0 ? 'Khối lượng ước tính theo lưới thép thiết kế' : NO_PRICE },
    { no: 'B.3', item: 'Vít xoắn ống thép Ø89×5, ren Ø105, mạ kẽm nhúng nóng', unit: 'md', quantity: screwM, rate: params.screwRate_VND_m, amount_VND: screwM * params.screwRate_VND_m, note: params.screwRate_VND_m > 0 ? 'Gồm đoạn xuyên đế và đầu khóa' : NO_PRICE },
    { no: 'B.4', item: 'Hạ đế xuống đáy hồ, vặn vít, khóa đầu vít (cẩu trên sà lan, thợ lặn)', unit: 'đế', quantity: bases, rate: params.baseInstallRate_VND_each, amount_VND: bases * params.baseInstallRate_VND_each, note: params.baseInstallRate_VND_each > 0 ? '' : NO_PRICE },
    { no: 'B.5', item: 'Khấu hao lắp đặt sàn đạo nổi / sà lan', unit: 'chiến dịch', quantity: bases > 0 ? 1 : 0, rate: params.bedBargeSetup_VND, amount_VND: bargeSetup, note: 'Cho cả chiến dịch lắp đế neo đáy' }
  ];
  const unpriced = screw
    ? baseLines.filter((l) => l.quantity > 0 && l.rate <= 0).map((l) => `${l.no} ${l.item}`)
    : [];

  const pileLines: CostLine[] = [
    {
      no: 'A', item: 'Cọc khoan nhồi trên bờ (đổ bê tông tại chỗ)', unit: 'md', quantity: shoreM, rate: shoreRate, amount_VND: shoreTotal,
      note: (params.shoreBoredCostMode === 'turnkey'
        ? 'Đơn giá trọn gói vật tư + nhân công'
        : `Nhân công ${params.shoreLaborRate_VND_m.toLocaleString('vi-VN')} + vật tư ${params.shoreMaterialRate_VND_m.toLocaleString('vi-VN')} đ/md`) +
        (params.shoreRebarSurcharge_VND_m > 0 ? ` + phụ phí cốt thép ${params.shoreRebarSurcharge_VND_m.toLocaleString('vi-VN')} đ/md` : '') +
        `; ${shoreN} cọc`
    },
    {
      no: 'B.1', item: 'Cọc đúc sẵn lòng hồ — mua cọc tại xưởng', unit: 'md', quantity: bedM, rate: bedMaterialRate, amount_VND: bedMaterial,
      note: `${bedN} cọc` + (params.bedRebarSurcharge_VND_m > 0 ? `; gồm phụ phí cốt thép ${params.bedRebarSurcharge_VND_m.toLocaleString('vi-VN')} đ/md` : '')
    },
    { no: 'B.2', item: 'Đóng cọc dưới nước (sà lan / hệ phao nổi + búa + nhân công)', unit: 'md', quantity: bedM, rate: params.bedDrivingRate_VND_m, amount_VND: bedDriving, note: 'Nước sâu > 1,5 m' },
    { no: 'B.3', item: 'Vận chuyển, cẩu bốc xếp hai đầu', unit: '%', quantity: params.bedLogisticsPercent, rate: bedMaterial, amount_VND: bedLogistics, note: '% trên tiền mua cọc (B.1)' },
    { no: 'B.4', item: 'Khấu hao lắp đặt sàn đạo nổi / sà lan', unit: 'chiến dịch', quantity: bedN > 0 ? 1 : 0, rate: params.bedBargeSetup_VND, amount_VND: bargeSetup, note: 'Cho cả chiến dịch đóng cọc lòng hồ' }
  ];
  const lines = screw ? [pileLines[0], ...baseLines] : pileLines;

  return {
    totalShorePiles: shoreN,
    totalShoreMeters: shoreM,
    totalBedPiles: bedN,
    totalBedMeters: bedM,
    totalPiles: shoreN + bedN,
    totalMeters: shoreM + bedM,
    shoreRate_VND_m: shoreRate,
    shoreTotal_VND: shoreTotal,
    bedMaterialTotal_VND: bedMaterial,
    bedDrivingTotal_VND: bedDriving,
    bedLogisticsTotal_VND: bedLogistics,
    bedBargeSetup_VND: bargeSetup,
    bedTotal_VND: bedTotal,
    directTotal_VND: direct,
    contingency_VND: contingency,
    beforeVat_VND: beforeVat,
    vat_VND: vat,
    grandTotal_VND: beforeVat + vat,
    bedAnchorKind: screw ? 'screwBase' : 'pile',
    totalBases: bases,
    baseConcrete_m3: baseConc,
    baseRebar_kg: baseSteel,
    screwLength_m: screwM,
    unpriced,
    shoreMainSteel_kg_m: shoreM > 0 ? shoreSteel / shoreM : 0,
    bedMainSteel_kg_m: bedM > 0 ? bedSteel / bedM : 0,
    lines,
    raftBreakdowns: [...byRaft.values()]
  };
}
