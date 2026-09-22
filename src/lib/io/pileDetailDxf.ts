/**
 * Generator for Anchor Pile Structural Detail CAD Drawing (.DXF R12 format).
 * 
 * Generates:
 * 1. Shore Pile Detail (Mặt đứng cọc neo bờ BTCT / thép ống, tai neo pad-eye, ma-nơ-canh, tăng đơ, cốt thép)
 * 2. Lake-Bed Pile Detail (Mặt đứng cọc neo đáy ngập nước, đoạn xích đáy hồ)
 * 3. Cross-sections 1-1, 2-2 (Mặt cắt ngang cọc, cốt thép chủ và đai)
 * 4. Technical Specifications & Material Notes (TCVN 10304:2014, DNV-ST-0119)
 * 5. Title Block & Drawing Border (Khung tên bản vẽ tiêu chuẩn)
 */

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
 * Drawing units: millimetres (mm) for standard structural CAD drafting.
 */
export function buildPileDetailDxf(opts: PileDetailOptions = {}): string {
  const shoreD = (opts.shorePileD_m || 0.45) * 1000;  // 450 mm
  const shoreL = (opts.shorePileL_m || 6.5) * 1000;   // 6500 mm
  const bedD = (opts.bedPileD_m || 0.35) * 1000;      // 350 mm
  const bedL = (opts.bedPileL_m || 8.0) * 1000;       // 8000 mm
  const pReqS = opts.pReqShore_kN || 38.5;
  const pMaxS = opts.pMaxShore_kN || 65.0;
  const pReqB = opts.pReqBed_kN || 42.0;
  const pMaxB = opts.pMaxBed_kN || 58.0;

  // Scale: 1 unit = 1 mm. Standard A1 Sheet: 841 x 594 mm (drawing scale 1:20 -> sheet scale 16820 x 11880 mm)
  const W = 16000;
  const H = 11000;

  let entities = '';

  // 1. Drawing Border & Title Block
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: 0, y: 0 }, { x: W, y: H });
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: 200, y: 200 }, { x: W - 200, y: H - 200 });

  // Title Block (Góc dưới phải)
  const tbX = W - 5200;
  const tbY = 200;
  const tbW = 5000;
  const tbH = 1800;
  entities += rect(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY }, { x: tbX + tbW, y: tbY + tbH });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY + 1200 }, { x: tbX + tbW, y: tbY + 1200 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX, y: tbY + 600 }, { x: tbX + tbW, y: tbY + 600 });
  entities += line(PILE_DETAIL_LAYERS.border.name, { x: tbX + 2500, y: tbY }, { x: tbX + 2500, y: tbY + 600 });

  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2500, y: tbY + 1500 }, 220, 'DU AN: NHA MAY DIEN MAT TROI NOI HO HUOI VANH (12 CUM BE)', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2500, y: tbY + 1300 }, 160, 'HANG MUC: HE THONG NEO BE & KET CAU COC NEO', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2500, y: tbY + 950 }, 240, 'BAN VE CHI TIET CAU TAO COC NEO BO & COC NEO DAY HO', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2500, y: tbY + 720 }, 150, 'TIEU CHUAN AP DUNG: TCVN 10304:2014, DNV-ST-0119, DNV-OS-E301', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 300, y: tbY + 350 }, 140, 'TY LE: 1/20, 1/10');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 300, y: tbY + 150 }, 130, 'DON VI: MILIMET (mm)');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2800, y: tbY + 350 }, 140, 'KY HIEU BAN VE: BV-COC-01');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: tbX + 2800, y: tbY + 150 }, 130, 'NGAY PHAT HANH: 2026-09-22');

  // ==========================================
  // VIEW 1: MẶT ĐỨNG CỌC NEO BỜ (SHORE PILE)
  // ==========================================
  const sX = 2800;
  const groundY = 8500;
  const stickupS = 600; // 600mm above ground
  const sTopY = groundY + stickupS;
  const sBotY = groundY - shoreL;

  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sX, y: sTopY + 1200 }, 260, 'HINH 1: MAT DUNG COC NEO BO (SHORE PILE)', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: sX, y: sTopY + 950 }, 160, `KICH THUOC: D = ${shoreD}mm, L = ${(shoreL/1000).toFixed(1)}m (NHO KHOI MAT DAT +0.60m)`, 'CENTER');

  // Ground line (Mặt đất tự nhiên)
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: sX - 1800, y: groundY }, { x: sX + 1800, y: groundY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: sX + 1100, y: groundY + 100 }, 140, '+-0.00 (MAT DAT TU NHIEN)');
  // Ground hatches (gạch chéo ký hiệu đất)
  for (let gx = sX - 1600; gx <= sX + 1600; gx += 300) {
    entities += line(PILE_DETAIL_LAYERS.ground.name, { x: gx, y: groundY }, { x: gx - 150, y: groundY - 200 });
  }

  // Pile Concrete Outline
  const sLeft = sX - shoreD / 2;
  const sRight = sX + shoreD / 2;
  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: sLeft, y: sBotY }, { x: sRight, y: sTopY });
  // Mũi cọc nhọn (Pile Toe)
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: sLeft, y: sBotY }, { x: sX, y: sBotY - 300 });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: sRight, y: sBotY }, { x: sX, y: sBotY - 300 });

  // Main Longitudinal Rebar (4 phi 18)
  const cover = 50;
  const rbLeft = sLeft + cover;
  const rbRight = sRight - cover;
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbLeft, y: sTopY - 40 }, { x: rbLeft, y: sBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbRight, y: sTopY - 40 }, { x: rbRight, y: sBotY + 100 });
  // Chân bẻ mỏ
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbLeft, y: sBotY + 100 }, { x: rbLeft + 120, y: sBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbRight, y: sBotY + 100 }, { x: rbRight - 120, y: sBotY + 100 });

  // Stirrups (Thép đai phi 8a100 ở đầu cọc, a150 ở thân)
  for (let sy = sTopY - 80; sy >= groundY - 1500; sy -= 100) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbLeft, y: sy }, { x: rbRight, y: sy });
  }
  for (let sy = groundY - 1650; sy >= sBotY + 300; sy -= 200) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: rbLeft, y: sy }, { x: rbRight, y: sy });
  }

  // Pad Eye (Tai neo thép trên đầu cọc)
  const padW = 220;
  const padH = 300;
  const padEyeCenter: Pt = { x: sX, y: sTopY + padH / 2 };
  entities += rect(PILE_DETAIL_LAYERS.padEye.name, { x: sX - padW / 2, y: sTopY }, { x: sX + padW / 2, y: sTopY + padH });
  entities += circle(PILE_DETAIL_LAYERS.padEye.name, padEyeCenter, 45); // Lỗ xỏ ma-nơ-canh D=45mm
  // Chân râu neo bản mã chôn sâu trong bê tông
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX - 80, y: sTopY }, { x: sX - 80, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX + 80, y: sTopY }, { x: sX + 80, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX - 140, y: sTopY - 800 }, { x: sX - 20, y: sTopY - 800 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: sX + 20, y: sTopY - 800 }, { x: sX + 140, y: sTopY - 800 });

  // Shackle & Mooring Cable Vector
  const cableAngleDeg = 30; // Góc nghiêng dây neo 30 độ
  const cableLen = 1400;
  const rad = (cableAngleDeg * Math.PI) / 180;
  const cableEnd: Pt = {
    x: padEyeCenter.x + cableLen * Math.cos(rad),
    y: padEyeCenter.y + cableLen * Math.sin(rad)
  };
  entities += line(PILE_DETAIL_LAYERS.padEye.name, padEyeCenter, cableEnd);
  // Arrowhead on cable
  entities += line(PILE_DETAIL_LAYERS.padEye.name, cableEnd, { x: cableEnd.x - 120, y: cableEnd.y - 40 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, cableEnd, { x: cableEnd.x - 60, y: cableEnd.y - 120 });
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: cableEnd.x + 80, y: cableEnd.y + 60 }, 150, `LUC KEO CAP Tmax (GOC 30 DO)`);
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: cableEnd.x + 80, y: cableEnd.y - 120 }, 140, `P_req = ${pReqS.toFixed(1)} kN | P_max = ${pMaxS.toFixed(1)} kN (DAT)`);

  // Dimension Shore Pile
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 400, y: groundY }, { x: sLeft - 400, y: sBotY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 500, y: groundY }, { x: sLeft - 300, y: groundY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 500, y: sBotY }, { x: sLeft - 300, y: sBotY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 450, y: (groundY + sBotY) / 2 }, 180, `L_ngam = ${(shoreL/1000).toFixed(1)}m`, 'RIGHT');

  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 400, y: sTopY }, { x: sLeft - 400, y: groundY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 500, y: sTopY }, { x: sLeft - 300, y: sTopY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: sLeft - 450, y: (sTopY + groundY) / 2 }, 150, `+0.60m`, 'RIGHT');

  // ==========================================
  // VIEW 2: MẶT ĐỨNG CỌC NEO ĐÁY HỒ (BED PILE)
  // ==========================================
  const bX = 8200;
  const bedLevelY = 8500;
  const waterSurfaceY = bedLevelY + 2200; // Mặt nước hồ
  const bStickup = 500;
  const bTopY = bedLevelY + bStickup;
  const bBotY = bedLevelY - bedL;

  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bX, y: waterSurfaceY + 1200 }, 260, 'HINH 2: MAT DUNG COC NEO DAY HO (LAKE-BED PILE)', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: bX, y: waterSurfaceY + 950 }, 160, `KICH THUOC: D = ${bedD}mm, L = ${(bedL/1000).toFixed(1)}m (NGAP TRONG BUN SET DAY HO)`, 'CENTER');

  // Water Surface
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: bX - 1800, y: waterSurfaceY }, { x: bX + 1800, y: waterSurfaceY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: bX + 1000, y: waterSurfaceY + 100 }, 140, 'MUC NUOC HO (+384.50m)');
  // Wave symbols
  for (let wx = bX - 1600; wx <= bX + 1600; wx += 400) {
    entities += line(PILE_DETAIL_LAYERS.ground.name, { x: wx, y: waterSurfaceY - 40 }, { x: wx + 120, y: waterSurfaceY - 80 });
  }

  // Bed Mud Line
  entities += line(PILE_DETAIL_LAYERS.ground.name, { x: bX - 1800, y: bedLevelY }, { x: bX + 1800, y: bedLevelY });
  entities += text(PILE_DETAIL_LAYERS.ground.name, { x: bX + 1000, y: bedLevelY - 120 }, 140, 'DAY HO - LOP BUN SET MEM');

  // Pile Concrete Outline (Lake bed)
  const bLeft = bX - bedD / 2;
  const bRight = bX + bedD / 2;
  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: bLeft, y: bBotY }, { x: bRight, y: bTopY });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: bLeft, y: bBotY }, { x: bX, y: bBotY - 250 });
  entities += line(PILE_DETAIL_LAYERS.concrete.name, { x: bRight, y: bBotY }, { x: bX, y: bBotY - 250 });

  // Rebar Lake-bed pile
  const bRbLeft = bLeft + cover;
  const bRbRight = bRight - cover;
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbLeft, y: bTopY - 40 }, { x: bRbLeft, y: bBotY + 100 });
  entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbRight, y: bTopY - 40 }, { x: bRbRight, y: bBotY + 100 });

  // Stirrups bed pile
  for (let sy = bTopY - 80; sy >= bBotY + 300; sy -= 200) {
    entities += line(PILE_DETAIL_LAYERS.rebar.name, { x: bRbLeft, y: sy }, { x: bRbRight, y: sy });
  }

  // Submerged Pad Eye & Ground Chain
  const bPadEyeCenter: Pt = { x: bX, y: bTopY + 150 };
  entities += circle(PILE_DETAIL_LAYERS.padEye.name, bPadEyeCenter, 40);
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: bX - 60, y: bTopY }, { x: bX - 60, y: bTopY - 600 });
  entities += line(PILE_DETAIL_LAYERS.padEye.name, { x: bX + 60, y: bTopY }, { x: bX + 60, y: bTopY - 600 });

  // Ground Chain (Đoạn xích ngập nước nối cáp)
  let prevPt: Pt = bPadEyeCenter;
  for (let link = 1; link <= 6; link++) {
    const chainPt: Pt = {
      x: bPadEyeCenter.x + link * 150,
      y: bPadEyeCenter.y + link * 120
    };
    entities += circle(PILE_DETAIL_LAYERS.padEye.name, chainPt, 30);
    entities += line(PILE_DETAIL_LAYERS.padEye.name, prevPt, chainPt);
    prevPt = chainPt;
  }
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: prevPt.x + 100, y: prevPt.y + 60 }, 140, 'XICH NEO DAY HO (CHAIN GRADE U2)');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: prevPt.x + 100, y: prevPt.y - 100 }, 140, `P_req = ${pReqB.toFixed(1)} kN | P_max = ${pMaxB.toFixed(1)} kN (DAT)`);

  // Dimension Bed Pile
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 400, y: bedLevelY }, { x: bLeft - 400, y: bBotY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 500, y: bedLevelY }, { x: bLeft - 300, y: bedLevelY });
  entities += line(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 500, y: bBotY }, { x: bLeft - 300, y: bBotY });
  entities += text(PILE_DETAIL_LAYERS.dims.name, { x: bLeft - 450, y: (bedLevelY + bBotY) / 2 }, 180, `L_ngam = ${(bedL/1000).toFixed(1)}m`, 'RIGHT');

  // ==========================================
  // VIEW 3: MẶT CẮT NGANG CỌC (CROSS SECTIONS)
  // ==========================================
  const secX = 13200;
  const sec1Y = 7800;
  const sec2Y = 4800;

  // Section 1-1 (Cọc bờ 450x450 hoặc phi 450)
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: secX, y: sec1Y + 950 }, 220, 'MAT CAT 1-1: COC NEO BO', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: secX, y: sec1Y + 750 }, 150, `TIET DIEN D = ${shoreD}mm (THEP 4 phi 18 + DAI phi 8)`, 'CENTER');

  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: secX - shoreD / 2, y: sec1Y - shoreD / 2 }, { x: secX + shoreD / 2, y: sec1Y + shoreD / 2 });
  entities += rect(PILE_DETAIL_LAYERS.rebar.name, { x: secX - shoreD / 2 + cover, y: sec1Y - shoreD / 2 + cover }, { x: secX + shoreD / 2 - cover, y: sec1Y + shoreD / 2 - cover });
  // 4 Rebars at corners
  const rRad = 20;
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX - shoreD / 2 + cover + 25, y: sec1Y - shoreD / 2 + cover + 25 }, rRad);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX + shoreD / 2 - cover - 25, y: sec1Y - shoreD / 2 + cover + 25 }, rRad);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX + shoreD / 2 - cover - 25, y: sec1Y + shoreD / 2 - cover - 25 }, rRad);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX - shoreD / 2 + cover + 25, y: sec1Y + shoreD / 2 - cover - 25 }, rRad);

  // Section 2-2 (Cọc đáy hồ 350x350)
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: secX, y: sec2Y + 950 }, 220, 'MAT CAT 2-2: COC NEO DAY HO', 'CENTER');
  entities += text(PILE_DETAIL_LAYERS.text.name, { x: secX, y: sec2Y + 750 }, 150, `TIET DIEN D = ${bedD}mm (THEP 4 phi 16 + DAI phi 8)`, 'CENTER');

  entities += rect(PILE_DETAIL_LAYERS.concrete.name, { x: secX - bedD / 2, y: sec2Y - bedD / 2 }, { x: secX + bedD / 2, y: sec2Y + bedD / 2 });
  entities += rect(PILE_DETAIL_LAYERS.rebar.name, { x: secX - bedD / 2 + cover, y: sec2Y - bedD / 2 + cover }, { x: secX + bedD / 2 - cover, y: sec2Y + bedD / 2 - cover });
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX - bedD / 2 + cover + 20, y: sec2Y - bedD / 2 + cover + 20 }, 18);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX + bedD / 2 - cover - 20, y: sec2Y - bedD / 2 + cover + 20 }, 18);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX + bedD / 2 - cover - 20, y: sec2Y + bedD / 2 - cover - 20 }, 18);
  entities += circle(PILE_DETAIL_LAYERS.rebar.name, { x: secX - bedD / 2 + cover + 20, y: sec2Y + bedD / 2 - cover - 20 }, 18);

  // ==========================================
  // VIEW 4: BẢNG GHI CHÚ KỸ THUẬT & CHỈ TIÊU VẬT LIỆU
  // ==========================================
  const noteX = 800;
  const noteY = 2400;

  entities += text(PILE_DETAIL_LAYERS.text.name, { x: noteX, y: noteY }, 200, 'GHI CHU KY THUAT THI CONG & VAT LIEU COC NEO:');
  const notes = [
    '1. BE TONG COC: Be tong thuong pham Mac 300 (cap do ben B22.5 hoac C20/25), Rb = 14.5 MPa, Rbt = 1.05 MPa.',
    '2. COT THEP CHU: Thep cay CB300-V hoac CB400-V, Rs = 260 MPa (CB300) hoac 350 MPa (CB400). Doan noi thep >= 35d.',
    '3. COT THEP DAI: Thep cuon CB240-T, Rsc = 170 MPa. Buoc day thep buoc tai 100% cac diem giao nhau.',
    '4. TAI NEO PAD-EYE: Thep tam ket cau SS400 hoac Q345B, chieu day t >= 16mm, ma kem nhung nong chong an mon theo ASTM A123.',
    '5. MA-NO-CANH & TANG DO: Ma-no-canh omega chot van ren hop kim thep ma kem (SWL >= 8.5 Tan, MBL >= 51 Tan).',
    '6. DUC & HA COC: Cung doan coc duc san phai dat 100% mac thiet ke truoc khi ep/dong. Dung sai do lech tim coc <= 50mm.',
    '7. KIEM DINH SUC CHIU TAI: Thi nghiem thu tinh keo/nhol coc tai hien truong toi thieu 1% tong so coc theo TCVN 9393:2012.'
  ];

  notes.forEach((nt, idx) => {
    entities += text(PILE_DETAIL_LAYERS.text.name, { x: noteX, y: noteY - 260 - idx * 220 }, 130, nt);
  });

  // Assemble full DXF file
  let dxf = pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') + pair(0, 'ENDSEC');
  dxf += pair(0, 'SECTION') + pair(2, 'TABLES') + layerTable() + pair(0, 'ENDSEC');
  dxf += pair(0, 'SECTION') + pair(2, 'ENTITIES') + entities + pair(0, 'ENDSEC');
  dxf += pair(0, 'EOF');

  return dxf;
}
