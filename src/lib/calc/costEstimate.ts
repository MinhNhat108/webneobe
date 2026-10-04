/**
 * Construction quotation: bored shore piles + driven lake-bed piles.
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
  contingencyPercent: 5,
  vatPercent: 8,
  includeVat: true
};

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

  /** Main reinforcement actually designed, kg per metre of pile (for the caveat on the reference prices). */
  shoreMainSteel_kg_m: number;
  bedMainSteel_kg_m: number;

  lines: CostLine[];
  raftBreakdowns: RaftCostBreakdown[];
}

export function calculateCostEstimate(params: CostParams, scheduleRows: PileScheduleRow[]): CostEstimateSummary {
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
    } else {
      bedN += n; bedM += metres; bedSteel += n * r.cage.mainSteel_kg;
      b.bedPiles += n; b.bedMeters += metres;
    }
  }

  const shoreTotal = shoreM * shoreRate;
  const bedMaterial = bedM * bedMaterialRate;
  const bedDriving = bedM * params.bedDrivingRate_VND_m;
  const bedLogistics = bedMaterial * logistics;
  const bargeSetup = bedN > 0 ? params.bedBargeSetup_VND : 0;
  const bedTotal = bedMaterial + bedDriving + bedLogistics + bargeSetup;

  // The barge set-up is a campaign cost: share it by metres of lake-bed pile.
  for (const b of byRaft.values()) {
    b.shoreCost_VND = b.shoreMeters * shoreRate;
    b.bedCost_VND =
      b.bedMeters * bedMaterialRate * (1 + logistics) + b.bedMeters * params.bedDrivingRate_VND_m + (bedM > 0 ? (bargeSetup * b.bedMeters) / bedM : 0);
    b.totalCost_VND = b.shoreCost_VND + b.bedCost_VND;
  }

  const direct = shoreTotal + bedTotal;
  const contingency = (direct * params.contingencyPercent) / 100;
  const beforeVat = direct + contingency;
  const vat = params.includeVat ? (beforeVat * params.vatPercent) / 100 : 0;

  const lines: CostLine[] = [
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
    shoreMainSteel_kg_m: shoreM > 0 ? shoreSteel / shoreM : 0,
    bedMainSteel_kg_m: bedM > 0 ? bedSteel / bedM : 0,
    lines,
    raftBreakdowns: [...byRaft.values()]
  };
}
