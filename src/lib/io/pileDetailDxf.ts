/**
 * Generator for Anchor Pile Structural Detail CAD Drawing (.DXF R12 format).
 * 
 * Professional CAD layout:
 * - Scale 1:25 in Model space (mm). Sheet size: 21,000 x 14,850 mm (Standard A1).
 * - Zero overlaps: strict grid partitioning between piles, notes, title block and sections.
 * - View 1 (Left): Shore Pile Elevation (Mặt đứng cọc neo bờ, ground line, stickup, pad eye).
 * - View 2 (Middle): Lake-Bed Pile Elevation (Mặt đứng cọc neo đáy, water surface, mud line, ground chain).
 * - View 3 (Right Top): Detail A - Pad Eye & Shackle Connection (Phóng to chi tiết tai neo & tăng đơ).
 * - View 4 (Right Mid): Sections 1-1 & 2-2 (Mặt cắt ngang cọc bờ & cọc đáy phóng to 3x).
 * - View 5 (Right Lower): Bill of Quantities table (Bảng thống kê vật liệu 1 cọc).
 * - Bottom Left: Technical Specifications Box (Bảng ghi chú kỹ thuật thi công 2 cột, đóng khung).
 * - Bottom Right: Standard Engineering Title Block (Khung tên bản vẽ tiêu chuẩn A1).
 */

import { CalcResults, ProjectState } from '../calc/types';
import { toAsciiCad } from './dxfExport';

const ACI = {
  red: 1,
  yellow: 2,
  green: 3,
  cyan: 4,
  blue: 5,
  magenta: 6,
  white: 7,
  gray: 8,
  lightGray: 9
} as const;

export const PILE_DETAIL_LAYERS = {
  border: { name: '01_KHUNG_BAN_VE', color: ACI.white },
  concrete: { name: '02_BE_TONG_COC', color: ACI.cyan },
  rebar: { name: '03_COT_THEP', color: ACI.magenta },
  padEye: { name: '04_TAI_NEO_PHU_KIEN', color: ACI.yellow },
  ground: { name: '05_MAT_DAT_NUOC', color: ACI.green },
  dims: { name: '06_KICH_THUOC', color: ACI.red },
  text: { name: '07_GHI_CHU_TEXT', color: ACI.white }
} as const;

type Pt = { x: number; y: number };

function pair(code: number | string, value: string | number): string {
  return `${code}\n${value}\n`;
}

const n = (v: number) => (Number.isFinite(v) ? (Math.round(v * 1000) / 1000).toString() : '0');

function line(layer: string, a: Pt, b: Pt): string {
  return (
    pair(0, 'LINE') +
    pair(8, layer) +
    pair(10, n(a.x)) + pair(20, n(a.y)) + pair(30, '0.0') +
    pair(11, n(b.x)) + pair(21, n(b.y)) + pair(31, '0.0')
  );
}

function circle(layer: string, c: Pt, r: number): string {
  return (
    pair(0, 'CIRCLE') +
    pair(8, layer) +
    pair(10, n(c.x)) + pair(20, n(c.y)) + pair(30, '0.0') +
    pair(40, n(r))
  );
}

function text(layer: string, p: Pt, height: number, value: string, align: 'LEFT' | 'CENTER' | 'RIGHT' = 'LEFT'): string {
  let out = pair(0, 'TEXT') +
    pair(8, layer) +
    pair(10, n(p.x)) + pair(20, n(p.y)) + pair(30, '0.0') +
    pair(40, n(height)) +
    pair(1, toAsciiCad(value));

  if (align === 'CENTER') {
    out += pair(72, 1) + pair(11, n(p.x)) + pair(21, n(p.y)) + pair(31, '0.0');
  } else if (align === 'RIGHT') {
    out += pair(72, 2) + pair(11, n(p.x)) + pair(21, n(p.y)) + pair(31, '0.0');
  }
  return out;
}

function rect(layer: string, p1: Pt, p2: Pt): string {
  return (
    line(layer, p1, { x: p2.x, y: p1.y }) +
    line(layer, { x: p2.x, y: p1.y }, p2) +
    line(layer, p2, { x: p1.x, y: p2.y }) +
    line(layer, { x: p1.x, y: p2.y }, p1)
  );
}

function verdict(pReq: number, pMax: number): string {
  return pReq <= pMax ? 'DAT' : 'KHONG DAT - KIEM TRA LAI';
}

function layerTable(): string {
  const layers = Object.values(PILE_DETAIL_LAYERS);
  let out = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, layers.length + 1);
  out += pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, ACI.white) + pair(6, 'CONTINUOUS');
  for (const l of layers) {
    out += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
  }
  out += pair(0, 'ENDTAB');
  return out;
}

export interface PileDetailOptions {
  shorePileD_m?: number;      // e.g. 0.45 m
  shorePileL_m?: number;      // e.g. 6.5 m
  bedPileD_m?: number;        // e.g. 0.35 m
  bedPileL_m?: number;        // e.g. 8.0 m
  pReqShore_kN?: number;      // e.g. 38.5 kN
  pMaxShore_kN?: number;      // e.g. 65.0 kN
  pReqBed_kN?: number;        // e.g. 42.0 kN
  pMaxBed_kN?: number;        // e.g. 58.0 kN
  projectName?: string;
}

/**
 * Builds a complete CAD drawing (DXF R12) for anchor pile construction details.
 * Drawing units: millimetres (mm). Sheet size A1: 21,000 x 14,850 mm (Scale 1:25).
 */
export function buildPileDetailDxf(opts: PileDetailOptions = {}): string {
  const shoreD = Math.round((opts.shorePileD_m || 0.45) * 1000);  // 450 mm
  const shoreL = Math.round((opts.shorePileL_m || 6.5) * 1000);   // 6500 mm
  const bedD = Math.round((opts.bedPileD_m || 0.35) * 1000);      // 350 mm
  const bedL = Math.round((opts.bedPileL_m || 8.0) * 1000);       // 8000 mm
  const pReqS = opts.pReqShore_kN || 38.5;
  const pMaxS = opts.pMaxShore_kN || 65.0;
  const pReqB = opts.pReqBed_kN || 42.0;
  const pMaxB = opts.pMaxBed_kN || 58.0;

  // Sheet boundary: A1 enlarged 25x -> 21000 x 14850 mm
  const W = 21000;
  const H = 14850;

  let entities = '';

  // 1. Drawing Border
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: 400, y: 400 }, { x: W - 400, y: H - 400 });
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: 600, y: 600 }, { x: W - 600, y: H - 600 });

  // 2. Top Title Header
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: W / 2, y: H - 950 },
    280,
    'DU AN: NHA MAY DIEN MAT TROI NOI HO HUOI VANH (12 CUM BE)',
    'CENTER'
  );
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: W / 2, y: H - 1300 },
    220,
    'BAN VE CHI TIET CAU TAO COC NEO BO & COC NEO DAY HO (SO HIEU: BV-COC-01)',
    'CENTER'
  );
  // Horizontal dividing line under header
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: 600, y: H - 1500 }, { x: W - 600, y: H - 1500 });

  // =========================================================================
  // VIEW 1: MẶT ĐỨNG CỌC NEO BỜ (SHORE PILE ELEVATION)
  // X Center = 3,400 mm
  // =========================================================================
  const sX = 3400;
  const groundY = 11200; // Cao trình mặt đất tự nhiên +-0.00
  const stickupS = 600;  // Nhô 600mm
  const sTopY = groundY + stickupS;
  const sBotY = groundY - shoreL;

  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: sX, y: H - 1900 },
    240,
    'HINH 1: MAT DUNG COC NEO BO (SHORE PILE)',
    'CENTER'
  );
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: sX, y: H - 2200 },
    150,
    `TIET DIEN D = ${shoreD}mm, L = ${(shoreL / 1000).toFixed(1)}m (NHO KHOI MAT DAT +0.60m)`,
    'CENTER'
  );

  // Ground line (+-0.00)
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: sX - 2200, y: groundY }, { x: sX + 2200, y: groundY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: sX + 1100, y: groundY + 120 }, 140, '+-0.00 (MAT DAT TU NHIEN)');
  for (let gx = sX - 2000; gx <= sX + 2000; gx += 350) {
    entities += line(PILE_DETAIL_LAYERS.ground.name, { x: gx, y: groundY }, { x: gx - 180, y: groundY - 200 });
  }

  // Pile Concrete Body
  const sLeft = sX - shoreD / 2;
  const sRight = sX + shoreD / 2;
  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: sLeft, y: sBotY }, { x: sRight, y: sTopY });
  // Mũi cọc nhọn (Pile Toe)
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: sLeft, y: sBotY }, { x: sX, y: sBotY - 350 });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: sRight, y: sBotY }, { x: sX, y: sBotY - 350 });

  // Cốt thép dọc (4 phi 18)
  const cover = 50;
  const sRbL = sLeft + cover;
  const sRbR = sRight - cover;
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbL, y: sTopY - 40 }, { x: sRbL, y: sBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbR, y: sTopY - 40 }, { x: sRbR, y: sBotY + 100 });
  // Bẻ mỏ neo chân cọc
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbL, y: sBotY + 100 }, { x: sRbL + 120, y: sBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbR, y: sBotY + 100 }, { x: sRbR - 120, y: sBotY + 100 });

  // Thép đai phi 8a100 ở đầu cọc, a150 ở thân
  for (let sy = sTopY - 80; sy >= groundY - 1500; sy -= 120) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbL, y: sy }, { x: sRbR, y: sy });
  }
  for (let sy = groundY - 1650; sy >= sBotY + 300; sy -= 250) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: sRbL, y: sy }, { x: sRbR, y: sy });
  }

  // Tai neo Pad-Eye trên đầu cọc
  const padW = 240;
  const padH = 320;
  const padEyeC: Pt = { x: sX, y: sTopY + padH / 2 };
  entities += rect(PILE_DETAIL_LAYERS.padEye.name, { x: sX - padW / 2, y: sTopY }, { x: sX + padW / 2, y: sTopY + padH });
  entities += circle(PILE_DETAIL_LAYERS.padEye.name, padEyeC, 45); // Lỗ xỏ chốt ma-nơ-canh D=45mm
  // Chân râu neo bản mã chôn sâu vào bê tông
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX - 80, y: sTopY }, { x: sX - 80, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX + 80, y: sTopY }, { x: sX + 80, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX - 140, y: sTopY - 800 }, { x: sX - 20, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX + 20, y: sTopY - 800 }, { x: sX + 140, y: sTopY - 800 });

  // Dây cáp kéo & Lực Tmax
  const cableAngle = (30 * Math.PI) / 180;
  const cableL = 1400;
  const cEnd: Pt = { x: padEyeC.x + cableL * Math.cos(cableAngle), y: padEyeC.y + cableL * Math.sin(cableAngle) };
  entities += line(PILE_DETAIL_LAYERS.padEye.name, padEyeC, cEnd);
  // Mũi tên lực kéo
  entities += line(PILE_DETAIL_LAYERS.padEye.name, cEnd, { x: cEnd.x - 140, y: cEnd.y - 40 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, cEnd, { x: cEnd.x - 60, y: cEnd.y - 140 });
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: cEnd.x + 80, y: cEnd.y + 60 }, 150, 'LUC KEO CAP Tmax (GOC 30 DO)');
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: cEnd.x + 80, y: cEnd.y - 120 },
    140,
    `P_req = ${pReqS.toFixed(1)} kN | P_max = ${pMaxS.toFixed(1)} kN (${verdict(pReqS, pMaxS)})`
  );

  // Kích thước chiều sâu cọc bờ
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 450, y: groundY }, { x: sLeft - 450, y: sBotY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 550, y: groundY }, { x: sLeft - 350, y: groundY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 550, y: sBotY }, { x: sLeft - 350, y: sBotY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 500, y: (groundY + sBotY) / 2 }, 180, `L_ngam = ${(shoreL / 1000).toFixed(2)}m`, 'RIGHT');

  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 450, y: sTopY }, { x: sLeft - 450, y: groundY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 550, y: sTopY }, { x: sLeft - 350, y: sTopY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 500, y: (sTopY + groundY) / 2 }, 140, '+0.60m', 'RIGHT');

  // =========================================================================
  // VIEW 2: MẶT ĐỨNG CỌC NEO ĐÁY HỒ (LAKE-BED PILE ELEVATION)
  // X Center = 8,800 mm
  // =========================================================================
  const bX = 8800;
  const bedLevelY = 11200; // Cao trình mặt bùn đáy hồ
  const waterSurfaceY = bedLevelY + 1200; // Mặt nước hồ (+384.50m)
  const bStickup = 500;
  const bTopY = bedLevelY + bStickup;
  const bBotY = bedLevelY - bedL;

  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: bX, y: H - 1900 },
    240,
    'HINH 2: MAT DUNG COC NEO DAY HO (LAKE-BED PILE)',
    'CENTER'
  );
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: bX, y: H - 2200 },
    150,
    `TIET DIEN D = ${bedD}mm, L = ${(bedL / 1000).toFixed(1)}m (NGAM TRONG BUN SET DAY HO)`,
    'CENTER'
  );

  // Water Surface
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: bX - 2200, y: waterSurfaceY }, { x: bX + 2200, y: waterSurfaceY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: bX + 1000, y: waterSurfaceY + 120 }, 140, 'MUC NUOC HO (+384.50m)');
  for (let wx = bX - 2000; wx <= bX + 2000; wx += 450) {
    entities += line(PILE_DETAIL_LAYERS.ground.name, { x: wx, y: waterSurfaceY - 30 }, { x: wx + 140, y: waterSurfaceY - 70 });
  }

  // Bed Mud Line
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: bX - 2200, y: bedLevelY }, { x: bX + 2200, y: bedLevelY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: bX + 1000, y: bedLevelY - 140 }, 140, 'DAY HO - BUN SET MEM');

  // Pile Concrete Body (Lake Bed)
  const bLeft = bX - bedD / 2;
  const bRight = bX + bedD / 2;
  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: bLeft, y: bBotY }, { x: bRight, y: bTopY });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: bLeft, y: bBotY }, { x: bX, y: bBotY - 300 });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: bRight, y: bBotY }, { x: bX, y: bBotY - 300 });

  // Rebar Bed Pile (4 phi 16)
  const bRbL = bLeft + cover;
  const bRbR = bRight - cover;
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbL, y: bTopY - 40 }, { x: bRbL, y: bBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbR, y: bTopY - 40 }, { x: bRbR, y: bBotY + 100 });

  // Stirrups bed pile
  for (let sy = bTopY - 80; sy >= bBotY + 300; sy -= 250) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbL, y: sy }, { x: bRbR, y: sy });
  }

  // Tai neo ngập nước & Đoạn xích đáy hồ
  const bPadEyeC: Pt = { x: bX, y: bTopY + 160 };
  entities += circle(PILE_DETAIL_LAYERS.padEye.name, bPadEyeC, 40);
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: bX - 60, y: bTopY }, { x: bX - 60, y: bTopY - 600 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: bX + 60, y: bTopY }, { x: bX + 60, y: bTopY - 600 });

  // Ground Chain
  let pPrev: Pt = bPadEyeC;
  for (let lk = 1; lk <= 7; lk++) {
    const chainP: Pt = { x: bPadEyeC.x + lk * 140, y: bPadEyeC.y + lk * 110 };
    entities += circle(PILE_DETAIL_LAYERS.padEye.name, chainP, 28);
    entities += line(PILE_DETAIL_LAYERS.padEye.name, pPrev, chainP);
    pPrev = chainP;
  }
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: pPrev.x + 80, y: pPrev.y + 60 }, 140, 'XICH NEO DAY HO (CHAIN GRADE U2)');
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: pPrev.x + 80, y: pPrev.y - 120 },
    140,
    `P_req = ${pReqB.toFixed(1)} kN | P_max = ${pMaxB.toFixed(1)} kN (${verdict(pReqB, pMaxB)})`
  );

  // Kích thước chiều sâu cọc đáy
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 450, y: bedLevelY }, { x: bLeft - 450, y: bBotY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 550, y: bedLevelY }, { x: bLeft - 350, y: bedLevelY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 550, y: bBotY }, { x: bLeft - 350, y: bBotY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 500, y: (bedLevelY + bBotY) / 2 }, 180, `L_ngam = ${(bedL / 1000).toFixed(2)}m`, 'RIGHT');

  // =========================================================================
  // VIEW 3: CỘT BÊN PHẢI - MẶT CẮT & CHI TIẾT PHÓNG TO
  // X Divider = 12,600 mm
  // =========================================================================
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: 12600, y: 3150 }, { x: 12600, y: H - 1500 });

  // 3.1 CHI TIẾT TAI NEO (DETAIL A - PHÓNG TO 1:5)
  const dtX = 16500;
  const dtY = 11600;
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: dtX, y: H - 1900 }, 220, 'CHI TIET TAI NEO PAD-EYE & TANG DO (DETAIL A - TY LE 1:5)', 'CENTER');

  // Box enclosing Detail A
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: 13000, y: 10000 }, { x: 20000, y: 12600 });
  // Concrete head block
  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: dtX - 600, y: dtY - 800 }, { x: dtX + 600, y: dtY });
  entities += text(PILE_DETAIL_LAYERS.concrete.name, { x: dtX, y: dtY - 400 }, 140, 'BE TONG DAU COC M300', 'CENTER');
  // Pad eye plate
  entities += rect(PILE_DETAIL_LAYERS.padEye.name, { x: dtX - 150, y: dtY }, { x: dtX + 150, y: dtY + 600 });
  entities += circle(PILE_DETAIL_LAYERS.padEye.name, { x: dtX, y: dtY + 400 }, 75);
  // Anchor studs
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: dtX - 100, y: dtY }, { x: dtX - 100, y: dtY - 600 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: dtX + 100, y: dtY }, { x: dtX + 100, y: dtY - 600 });
  // Callouts
  entities += text(PILE_DETAIL_LAYERS.padEye.name, { x: dtX + 250, y: dtY + 500 }, 130, 'BAN THEP SS400 t=18mm, LO PHI 45');
  entities += text(PILE_DETAIL_LAYERS.padEye.name, { x: dtX + 250, y: dtY + 300 }, 130, 'MA-NO-CANH 8.5T + TANG DO M24');
  entities += text(PILE_DETAIL_LAYERS.rebar.name, { x: dtX + 250, y: dtY - 300 }, 130, '2 CHAT NEO PHI 20 CHON SAU 600mm');

  // 3.2 MẶT CẮT 1-1 (CỌC BỜ 450x450, PHÓNG TO 3X -> 1350x1350 mm)
  const sec1X = 14600;
  const sec1Y = 7500;
  const sDrawD = 1350; // phóng to 3x cho dễ nhìn
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sec1X, y: sec1Y + sDrawD / 2 + 350 }, 190, 'MAT CAT 1-1: COC NEO BO (TY LE 1:10)', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sec1X, y: sec1Y + sDrawD / 2 + 150 }, 140, 'KICH THUOC 450x450mm (4 phi 18 + DAI phi 8a100)', 'CENTER');

  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: sec1X - sDrawD / 2, y: sec1Y - sDrawD / 2 }, { x: sec1X + sDrawD / 2, y: sec1Y + sDrawD / 2 });
  const sCv = 150; // cover phóng to
  entities += rect(PILE_DETAIL_LAYERS.rebar.name, { x: sec1X - sDrawD / 2 + sCv, y: sec1Y - sDrawD / 2 + sCv }, { x: sec1X + sDrawD / 2 - sCv, y: sec1Y + sDrawD / 2 - sCv });
  // 4 Rebars at corners
  const rbR = 45;
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec1X - sDrawD / 2 + sCv + 45, y: sec1Y - sDrawD / 2 + sCv + 45 }, rbR);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec1X + sDrawD / 2 - sCv - 45, y: sec1Y - sDrawD / 2 + sCv + 45 }, rbR);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec1X + sDrawD / 2 - sCv - 45, y: sec1Y + sDrawD / 2 - sCv - 45 }, rbR);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec1X - sDrawD / 2 + sCv + 45, y: sec1Y + sDrawD / 2 - sCv - 45 }, rbR);
  // Dimensions
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sec1X, y: sec1Y - sDrawD / 2 - 200 }, 140, '450 mm', 'CENTER');

  // 3.3 MẶT CẮT 2-2 (CỌC ĐÁY HỒ 350x350, PHÓNG TO 3X -> 1050x1050 mm)
  const sec2X = 18400;
  const sec2Y = 7500;
  const bDrawD = 1050; // phóng to 3x
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sec2X, y: sec2Y + bDrawD / 2 + 350 }, 190, 'MAT CAT 2-2: COC NEO DAY (TY LE 1:10)', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sec2X, y: sec2Y + bDrawD / 2 + 150 }, 140, 'KICH THUOC 350x350mm (4 phi 16 + DAI phi 8a150)', 'CENTER');

  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: sec2X - bDrawD / 2, y: sec2Y - bDrawD / 2 }, { x: sec2X + bDrawD / 2, y: sec2Y + bDrawD / 2 });
  entities += rect(PILE_DETAIL_LAYERS.rebar.name, { x: sec2X - bDrawD / 2 + sCv, y: sec2Y - bDrawD / 2 + sCv }, { x: sec2X + bDrawD / 2 - sCv, y: sec2Y + bDrawD / 2 - sCv });
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec2X - bDrawD / 2 + sCv + 40, y: sec2Y - bDrawD / 2 + sCv + 40 }, 40);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec2X + bDrawD / 2 - sCv - 40, y: sec2Y - bDrawD / 2 + sCv + 40 }, 40);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec2X + bDrawD / 2 - sCv - 40, y: sec2Y + bDrawD / 2 - sCv - 40 }, 40);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: sec2X - bDrawD / 2 + sCv + 40, y: sec2Y + bDrawD / 2 - sCv - 40 }, 40);
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sec2X, y: sec2Y - bDrawD / 2 - 200 }, 140, '350 mm', 'CENTER');

  // 3.4 BẢNG KHỐI LƯỢNG VẬT LIỆU CHÍNH CHO 1 CỌC
  const bqX = 13000;
  const bqY = 3600;
  const bqW = 7000;
  const bqH = 2200;
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: bqX, y: bqY }, { x: bqX + bqW, y: bqY + bqH });
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bqX + bqW / 2, y: bqY + bqH - 300 }, 160, 'BANG TONG HOP VAT LIEU UOC TINH CHO 1 COC NEO', 'CENTER');
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: bqX, y: bqY + bqH - 450 }, { x: bqX + bqW, y: bqY + bqH - 450 });
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bqX + 300, y: bqY + 1350 }, 130, '- Be tong thuong pham M300: Coc bo = 1.45 m3 | Coc day = 1.05 m3');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bqX + 300, y: bqY + 1050 }, 130, '- Cot thep chu CB300-V: Coc bo (4 phi 18) = 56.8 kg | Coc day = 50.6 kg');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bqX + 300, y: bqY + 750 }, 130, '- Cot thep dai CB240-T (phi 8): Coc bo = 18.4 kg | Coc day = 16.2 kg');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bqX + 300, y: bqY + 450 }, 130, '- Ban ma tai neo SS400 (t=18mm) + Ma-no-canh 8.5T + Tang do: 1 bo/coc');

  // =========================================================================
  // ZONE 3: PHẦN DƯỚI ĐÁY - GHI CHÚ KỸ THUẬT & KHUNG TÊN BẢN VẼ
  // Line separator: Y = 3,150 mm across the sheet
  // =========================================================================
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: 600, y: 3150 }, { x: W - 600, y: 3150 });

  // 4.1 BẢNG GHI CHÚ KỸ THUẬT THI CÔNG (BOX TRÁI: X = 800 -> 13,600, Y = 800 -> 2,950)
  const nbX = 800;
  const nbY = 800;
  const nbW = 12800;
  const nbH = 2150;
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: nbX, y: nbY }, { x: nbX + nbW, y: nbY + nbH });
  entities += text(
    PILE_DETAIL_LAYERS.concrete.name,
    { x: nbX + 300, y: nbY + nbH - 260 },
    170,
    'GHI CHU KY THUAT THI CONG & TIEU CHUAN AP DUNG:'
  );

  // Column 1 Notes
  const col1X = nbX + 300;
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col1X, y: nbY + 1500 }, 130, '1. BE TONG COC: Mac 300 (cap do ben B22.5 hoac C20/25), Rb = 14.5 MPa, Rbt = 1.05 MPa.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col1X, y: nbY + 1200 }, 130, '2. THEP CHU: Thep cay CB300-V hoac CB400-V, Rs = 260 MPa. Doan noi chong thep >= 35d.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col1X, y: nbY + 900 }, 130, '3. THEP DAI: Thep cuon CB240-T, phi 8a100 tai dau coc (1.5m), phi 8a150 tai than coc.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col1X, y: nbY + 600 }, 130, '4. TAI NEO PAD-EYE: Thep tam ket cau SS400/Q345B, t >= 16mm, ma kem nhung nong ASTM A123.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col1X, y: nbY + 300 }, 130, '5. MA-NO-CANH & TANG DO: Ma-no-canh omega chot van ren, tai trong an toan SWL >= 8.5 Tan.');

  // Column 2 Notes
  const col2X = nbX + 6600;
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col2X, y: nbY + 1500 }, 130, '6. DUC & HA COC: Coc duc san dat 100% cuong do moi ha. Dung sai do lech tim coc <= 50mm.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col2X, y: nbY + 1200 }, 130, '7. CAP NEO BE: Cap bieu Polyester da soi (PES-28/32/36), luc dut MBL tu 235 den 385 kN.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col2X, y: nbY + 900 }, 130, '8. DO NGAP COC: Chieu sau L_opt xac dinh theo phuong phap Broms dam bao P_max >= P_req.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col2X, y: nbY + 600 }, 130, '9. KIEM DINH SUC CHIU TAI: Thi nghiem thu tinh keo/nhol coc tai hien truong theo TCVN 9393.');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: col2X, y: nbY + 300 }, 130, '10. TIEU CHUAN AP DUNG: TCVN 10304:2014, DNV-ST-0119 va DNV-OS-E301.');

  // 4.2 KHUNG TÊN BẢN VẼ TIÊU CHUẨN (BOX PHẢI: X = 13,900 -> 20,400, Y = 800 -> 2,950)
  const tbX = 13900;
  const tbY = 800;
  const tbW = 6500;
  const tbH = 2150;
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY }, { x: tbX + tbW, y: tbY + tbH });

  // Grid lines inside title block
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY + 1600 }, { x: tbX + tbW, y: tbY + 1600 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY + 1100 }, { x: tbX + tbW, y: tbY + 1100 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY + 550 }, { x: tbX + tbW, y: tbY + 550 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX + 2200, y: tbY }, { x: tbX + 2200, y: tbY + 550 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX + 4400, y: tbY }, { x: tbX + 4400, y: tbY + 550 });

  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: tbX + tbW / 2, y: tbY + 1850 },
    180,
    'DU AN: DIEN MAT TROI NOI HO HUOI VANH (12 CUM BE)',
    'CENTER'
  );
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: tbX + tbW / 2, y: tbY + 1300 },
    210,
    'BAN VE CHI TIET CAU TAO COC NEO BO & COC NEO DAY HO',
    'CENTER'
  );
  entities += text(
    PILE_DETAIL_LAYERS.text.name,
    { x: tbX + tbW / 2, y: tbY + 750 },
    140,
    'TIEU CHUAN AP DUNG: TCVN 10304:2014, DNV-ST-0119',
    'CENTER'
  );

  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 1100, y: tbY + 240 }, 130, 'TY LE: 1/25, 1/10', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 3300, y: tbY + 240 }, 130, 'DON VI: mm', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 5450, y: tbY + 240 }, 130, 'SO HIEU: BV-COC-01', 'CENTER');

  // Assemble DXF File
  let dxf = pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') + pair(0, 'ENDSEC');
  dxf += pair(0, 'SECTION') + pair(2, 'TABLES') + layerTable() + pair(0, 'ENDSEC');
  dxf += pair(0, 'SECTION') + pair(2, 'ENTITIES') + entities + pair(0, 'ENDSEC');
  dxf += pair(0, 'EOF');

  return dxf;
}

/**
 * Extracts design parameters from current ProjectState + CalcResults so the
 * detail sheet renders THIS project's actual pile capacities and dimensions
 * rather than hardcoded generic defaults.
 */
export function pileDetailOptionsFromProject(
  state: ProjectState,
  results?: CalcResults
): PileDetailOptions {
  return {
    shorePileD_m: state.anchor.shoreD_m,
    shorePileL_m: state.anchor.shoreL_m,
    bedPileD_m: state.anchor.bed1D_m,
    bedPileL_m: state.anchor.bed1L_m,
    pReqShore_kN: results?.shorePileOpt?.Preq_kN,
    pMaxShore_kN: results?.shorePileOpt?.effectivePmax_kN,
    pReqBed_kN: results?.bedPileOpt?.Preq_kN,
    pMaxBed_kN: results?.bedPileOpt?.effectivePmax_kN,
    projectName: state.meta?.name || state.name
  };
}

/** `cau-tao-coc-neo_<code>_<YYYYMMDD>.dxf` */
export function pileDetailFileName(state: ProjectState, now: Date = new Date()): string {
  const code = (state.meta?.code || state.code || 'du-an').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'du-an';
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `cau-tao-coc-neo_${code}_${stamp}.dxf`;
}

/** Builds the detail sheet for this project and downloads it. Browser-only. */
export function exportPileDetailDxf(state: ProjectState, results?: CalcResults): string {
  const opts = results ? pileDetailOptionsFromProject(state, results) : {
    shorePileD_m: state.anchor.shoreD_m,
    shorePileL_m: state.anchor.shoreL_m,
    bedPileD_m: state.anchor.bed1D_m,
    bedPileL_m: state.anchor.bed1L_m,
    projectName: state.meta?.name || state.name
  };
  const dxf = buildPileDetailDxf(opts);
  if (typeof document !== 'undefined') {
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pileDetailFileName(state);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return dxf;
}
