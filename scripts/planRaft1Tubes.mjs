/**
 * BÈ 1 — layout and strength check of the transverse 40x60 tubes.
 *
 *   node --max-old-space-size=6144 scripts/planRaft1Tubes.mjs <be_pin_1.dxf> [outDir]
 *
 * Reads the raft plan exported from the client's drawing (floats + the C52
 * beams, which the drawing names "hOP 40X60" on layer S-BEAM and which run
 * ACROSS the float rows), and lays the 40x60 tubes on top of the C52 beams,
 * parallel to the float rows, following the supplier's installation sheet:
 *   - tube used as a MOORING point  -> fixed to every C52 it crosses with a
 *     "几" clamp (1 hex bolt M10x120 on top + 2 rhombus-nut bolts M10x30);
 *   - tube used only as BRACING     -> 1 hex bolt M10x120 per C52 crossing.
 *
 * The design load is this project's line tension for BÈ 1 (calculation
 * engine, 12 deg tilt, V = 30 m/s) times the load factor.
 *
 * CAPACITIES MARKED "ASSUMED" ARE NOT SUPPLIER DATA. The whole result scales
 * with them; they must be replaced by the float-system supplier's values
 * before anything is built.
 *
 * Output (in outDir): be1_ong_40x60.dxf (R12, millimetres, the SAME coordinates
 * as the client's drawing so it can be overlaid), be1_ong_40x60.json, BAO_CAO.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ inputs
const T_LINE_KN = 69.0; // BÈ 1 governing line tension (engine, 12° tilt)
const GAMMA = 1.2; // load factor, as for the pile bending check
const P_DESIGN_KN = T_LINE_KN * GAMMA;

// 40 x 60 x 2.0 mm rectangular hollow section, steel Q235 / SS400 (ASSUMED material and thickness)
const TUBE = { b: 40, h: 60, t: 2.0, f_MPa: 210, stock_m: 6.0 };
// One "几" clamp: 2 rhombus-nut bolts M10x30 in the C52 slot + 1 hex bolt M10x120.
// Its capacity is governed by the slip / lip bearing of the channel nuts, not by the bolt shank.
const CLAMP_CAPACITY_KN = 7.0; // ASSUMED: 2 channel nuts x 3.5 kN design slip. SUPPLIER VALUE REQUIRED.
const BOLT_ONLY_CAPACITY_KN = 3.5; // ASSUMED, bracing connection (1 x M10x120)
const C52 = { W_cm3: 4.0, f_MPa: 210 }; // ASSUMED section modulus of the C52 channel about its weak axis
const FLOAT_ROW_PITCH_M = 2.0;
const BRACE_EVERY_ROWS = 3; // one bracing line every 3 float rows (6 m)
const TUBE_OFFSET_FROM_FLOAT_ROW_M = 0.3; // tube centre line beside a float row, where the C52 is supported

// BÈ 1 mooring cleats in site coordinates (huoiVanhCoordinates_v2.json) and the raft outline (huoiVanhRaftPolygons_v2.json)
const here = path.dirname(fileURLToPath(import.meta.url));
const lines = JSON.parse(fs.readFileSync(path.join(here, '../src/data/huoiVanhCoordinates_v2.json'), 'utf8')).filter((l) => l.raft === 'BÈ 1');
const poly = JSON.parse(fs.readFileSync(path.join(here, '../src/data/huoiVanhRaftPolygons_v2.json'), 'utf8')).find((p) => p.name === 'BÈ 1').points;

// ------------------------------------------------------------------ DXF reading
const dxfPath = process.argv[2];
if (!dxfPath) { console.error('usage: node scripts/planRaft1Tubes.mjs <be_pin_1.dxf> [outDir]'); process.exit(1); }
const outDir = process.argv[3] ?? path.join(here, '../docs/be1-ong-40x60');
const raw = fs.readFileSync(dxfPath, 'utf8').split(/\r?\n/);
let section = '', curBlock = null;
const blockBox = new Map(); // block name -> [x0,y0,x1,y1] of its own LINEs
const inserts = [];
for (let i = 0; i + 1 < raw.length; i += 2) {
  if (raw[i].trim() !== '0') continue;
  const val = raw[i + 1].trim();
  if (val === 'SECTION') { section = raw[i + 3].trim(); continue; }
  if (section !== 'BLOCKS' && section !== 'ENTITIES') continue;
  if (val !== 'BLOCK' && val !== 'ENDBLK' && val !== 'INSERT' && val !== 'LINE') continue;
  const e = { layer: '', name: '', xs: [], ys: [], rot: 0 };
  for (let j = i + 2; j + 1 < raw.length; j += 2) {
    const c = raw[j].trim(), v = raw[j + 1].trim();
    if (c === '0') break;
    if (c === '8') e.layer = v; else if (c === '2') e.name = v; else if (c === '50') e.rot = parseFloat(v);
    else if (c === '10' || c === '11') e.xs.push(parseFloat(v)); else if (c === '20' || c === '21') e.ys.push(parseFloat(v));
  }
  if (section === 'BLOCKS') {
    if (val === 'BLOCK') curBlock = e.name;
    else if (val === 'ENDBLK') curBlock = null;
    else if (val === 'LINE' && curBlock) {
      const b = blockBox.get(curBlock) ?? [Infinity, Infinity, -Infinity, -Infinity];
      b[0] = Math.min(b[0], ...e.xs); b[1] = Math.min(b[1], ...e.ys); b[2] = Math.max(b[2], ...e.xs); b[3] = Math.max(b[3], ...e.ys);
      blockBox.set(curBlock, b);
    }
  } else if (val === 'INSERT') inserts.push(e);
}

// C52 beams: vertical members on S-BEAM (the drawing's block family is called "hOP 40X60"); local x = along the float rows.
const beams = inserts.filter((e) => e.layer === 'S-BEAM').map((e) => {
  const bb = blockBox.get(e.name); // the block is drawn along its own x, rotated 90°
  return { x: e.xs[0], y0: e.ys[0] + bb[0], y1: e.ys[0] + bb[2] };
}).sort((a, b) => a.x - b.x);
// Float rows carrying panels: horizontal strips, one y per row.
const floatRows = [...new Set(inserts.filter((e) => e.name.startsWith('Dai phao do pin')).map((e) => Math.round(e.ys[0])))].sort((a, b) => a - b);
if (beams.length === 0 || floatRows.length === 0) throw new Error('C52 beams or float rows not found in the drawing');

const xMin = beams[0].x, xMax = beams[beams.length - 1].x;
const yMin = Math.min(...beams.map((b) => b.y0)), yMax = Math.max(...beams.map((b) => b.y1));
const mm = (m) => m * 1000;

// ------------------------------------------------------------------ site -> drawing mapping of the 19 cleats
// The outline in the site layout is the same rectangle-with-a-notch, rotated: map along its two axes.
const P0 = poly[5], PX = poly[0], PY = poly[4]; // full-width corner; far end of the full-length side; other end of the full-width side
const ux = [PX.x - P0.x, PX.y - P0.y], uy = [PY.x - P0.x, PY.y - P0.y];
const lenX = Math.hypot(...ux), lenY = Math.hypot(...uy);
const cleats = lines.map((l) => {
  const d = [l.xRaft - P0.x, l.yRaft - P0.y];
  const s = (d[0] * ux[0] + d[1] * ux[1]) / (lenX * lenX), t = (d[0] * uy[0] + d[1] * uy[1]) / (lenY * lenY);
  const x = xMin + Math.min(1, Math.max(0, s)) * (xMax - xMin), y = yMin + Math.min(1, Math.max(0, t)) * (yMax - yMin);
  // which edge the cable leaves from = the direction it pulls in, in the raft's own axes
  const pull = [l.xAnchor - l.xRaft, l.yAnchor - l.yRaft];
  const px = (pull[0] * ux[0] + pull[1] * ux[1]) / lenX, py = (pull[0] * uy[0] + pull[1] * uy[1]) / lenY;
  const edge = Math.abs(px) > Math.abs(py) ? (px > 0 ? 'right' : 'left') : (py > 0 ? 'top' : 'bottom');
  return { code: l.code, type: l.type, x, y, edge };
});

// ------------------------------------------------------------------ strength
const { b, h, t } = TUBE;
const A = b * h - (b - 2 * t) * (h - 2 * t); // mm2
const Ix = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12; // about the axis that bends the 60 mm depth
const Wx = Ix / (h / 2), Iy = (h * b ** 3 - (h - 2 * t) * (b - 2 * t) ** 3) / 12, Wy = Iy / (b / 2);
const N_tube_kN = (A * TUBE.f_MPa) / 1000;
const M_tube_kNm = (Wx * TUBE.f_MPa) / 1e6;
const beamPitch = (xMax - xMin) / (beams.length - 1) / 1000; // m, average
// One cable hooked at ONE point of the tube, mid-way between two C52: the tube works as a beam between them.
const M_singlePoint_kNm = (P_DESIGN_KN * 1.4) / 4; // widest C52 gap 1.4 m
const clampsPerLine = Math.ceil(P_DESIGN_KN / CLAMP_CAPACITY_KN - 1e-9);
const tubesPerEndLine = Math.ceil(P_DESIGN_KN / N_tube_kN - 1e-9); // tubes in tension for a cable pulling along the tube
// End-face lines pull ALONG the tube, so each clamp pushes its C52 sideways. The C52 spans 2 m between float rows
// and the clamp sits TUBE_OFFSET from a row: M = P·a·b / L. That bending, not the clamp, limits the force per clamp.
const M_c52_cap_kNm = (C52.W_cm3 * C52.f_MPa) / 1000;
const aOff = TUBE_OFFSET_FROM_FLOAT_ROW_M, bOff = FLOAT_ROW_PITCH_M - TUBE_OFFSET_FROM_FLOAT_ROW_M;
const endClampCapacity_kN = Math.min(CLAMP_CAPACITY_KN, (M_c52_cap_kNm * FLOAT_ROW_PITCH_M) / (aOff * bOff));
const clampsPerEndLine = Math.ceil(P_DESIGN_KN / endClampCapacity_kN - 1e-9);
const M_c52_midspan_kNm = (CLAMP_CAPACITY_KN * FLOAT_ROW_PITCH_M) / 4;

// ------------------------------------------------------------------ layout
const tubes = []; // {kind:'anchor'|'brace', y, x0, x1, line?}
const clamps = []; // {x, y, kind:'clamp'|'bolt'}
const beamsAt = (y) => beams.filter((bm) => y >= bm.y0 - 1 && y <= bm.y1 + 1);
const nearestRowY = (y, inside) => {
  // beside the float row nearest to y, shifted towards the inside of the raft
  const row = floatRows.reduce((p, q) => (Math.abs(q - y) < Math.abs(p - y) ? q : p), floatRows[0]);
  return row + inside * mm(TUBE_OFFSET_FROM_FLOAT_ROW_M);
};
const yBottom = nearestRowY(floatRows[0], +1);
const topRowAt = (x) => Math.max(...floatRows.filter((r) => beams.some((bm) => Math.abs(bm.x - x) < 800 && r <= bm.y1)));

// Long edges (cable pulls ALONG the C52): the cable goes through a spreader / bridle to `clampsPerLine` clamps,
// one per C52, so the anchor tube covers the `clampsPerLine` C52 nearest to the cleat.
// Two neighbouring lines may not share a clamp: when their windows collide, the later line moves one float row inwards
// (a C52 can carry one clamp per row).
const taken = new Set(); // "x|y" of clamps already assigned
for (const c of cleats.filter((k) => k.edge === 'bottom' || k.edge === 'top').sort((p, q) => p.x - q.x)) {
  const inward = c.edge === 'bottom' ? +1 : -1;
  const y1 = c.edge === 'bottom' ? yBottom : nearestRowY(topRowAt(c.x), -1);
  for (let rowIndex = 0; rowIndex < 6 && !c.clampCount; rowIndex++) {
    const y = y1 + inward * rowIndex * mm(FLOAT_ROW_PITCH_M);
    const cand = beamsAt(y).map((bm) => bm.x);
    let start = cand.findIndex((x) => x >= c.x) - Math.floor(clampsPerLine / 2);
    start = Math.max(0, Math.min(cand.length - clampsPerLine, start));
    const used = cand.slice(start, start + clampsPerLine);
    if (used.length < clampsPerLine || used.some((x) => taken.has(`${x}|${y}`))) continue;
    tubes.push({ kind: 'anchor', y, x0: used[0] - 300, x1: used[used.length - 1] + 300, line: c.code });
    for (const x of used) { clamps.push({ x, y, kind: 'clamp', line: c.code }); taken.add(`${x}|${y}`); }
    c.clampCount = used.length;
    c.row = rowIndex + 1;
  }
  if (!c.clampCount) throw new Error(`no free C52 for ${c.code}`);
}
// End faces (cable pulls ALONG the tube): tubes in tension reaching into the raft, each beside a float row.
for (const c of cleats.filter((k) => k.edge === 'left' || k.edge === 'right')) {
  const perTube = Math.ceil(clampsPerEndLine / tubesPerEndLine);
  c.clampCount = 0;
  c.row = 1;
  const rowsNear = [...floatRows].sort((p, q) => Math.abs(p - c.y) - Math.abs(q - c.y));
  let placed = 0;
  for (const row of rowsNear) {
    if (placed >= tubesPerEndLine) break;
    const y = row + mm(TUBE_OFFSET_FROM_FLOAT_ROW_M);
    const cand = beamsAt(y).map((bm) => bm.x);
    const used = c.edge === 'left' ? cand.slice(0, perTube) : cand.slice(-perTube);
    if (used.length < perTube || used.some((x) => taken.has(`${x}|${y}`))) continue;
    tubes.push({ kind: 'anchor', y, x0: used[0] - 300, x1: used[used.length - 1] + 300, line: c.code });
    for (const x of used) { clamps.push({ x, y, kind: 'clamp', line: c.code }); taken.add(`${x}|${y}`); }
    c.clampCount += used.length;
    placed++;
  }
  if (placed < tubesPerEndLine) throw new Error(`no free row for ${c.code}`);
}
// Bracing lines across the whole raft, one every BRACE_EVERY_ROWS float rows, plus the two outer rows.
const braceRows = floatRows.filter((_, i) => i % BRACE_EVERY_ROWS === 0);
if (!braceRows.includes(floatRows[floatRows.length - 1])) braceRows.push(floatRows[floatRows.length - 1]);
for (const row of braceRows) {
  const y = row === floatRows[floatRows.length - 1] ? row - mm(TUBE_OFFSET_FROM_FLOAT_ROW_M) : row + mm(TUBE_OFFSET_FROM_FLOAT_ROW_M);
  const cand = beamsAt(y).map((bm) => bm.x);
  if (cand.length < 2) continue;
  tubes.push({ kind: 'brace', y, x0: cand[0] - 300, x1: cand[cand.length - 1] + 300 });
  for (const x of cand) {
    // a crossing that already carries an anchor clamp on the same line keeps the clamp
    if (!clamps.some((k) => k.kind === 'clamp' && Math.abs(k.x - x) < 1 && Math.abs(k.y - y) < 1)) clamps.push({ x, y, kind: 'bolt' });
  }
}

// ------------------------------------------------------------------ quantities
const tubeMetres = (kind) => tubes.filter((tb) => tb.kind === kind).reduce((s, tb) => s + (tb.x1 - tb.x0) / 1000, 0);
const nClamp = clamps.filter((k) => k.kind === 'clamp').length, nBolt = clamps.filter((k) => k.kind === 'bolt').length;
const totalM = tubeMetres('anchor') + tubeMetres('brace');
const bom = {
  anchorTubes: tubes.filter((tb) => tb.kind === 'anchor').length,
  anchorTube_m: +tubeMetres('anchor').toFixed(1),
  braceTubes: tubes.filter((tb) => tb.kind === 'brace').length,
  braceTube_m: +tubeMetres('brace').toFixed(1),
  tubeTotal_m: +totalM.toFixed(1),
  tubeStock6m: Math.ceil((totalM * 1.05) / TUBE.stock_m), // 5 % cutting waste
  clamps_ki: nClamp,
  hexBolt_M10x120: nClamp + nBolt,
  rhombusNutBolt_M10x30: 2 * nClamp
};
const checks = {
  designPull_kN: +P_DESIGN_KN.toFixed(1),
  tube: { A_mm2: +A.toFixed(0), Wx_cm3: +(Wx / 1000).toFixed(2), Wy_cm3: +(Wy / 1000).toFixed(2), tension_kN: +N_tube_kN.toFixed(1), bending_kNm: +M_tube_kNm.toFixed(2) },
  singlePointHook: { moment_kNm: +M_singlePoint_kNm.toFixed(1), utilisation: +(M_singlePoint_kNm / M_tube_kNm).toFixed(1), ok: M_singlePoint_kNm <= M_tube_kNm },
  clampsPerLine,
  clampUtilisation: +(P_DESIGN_KN / (clampsPerLine * CLAMP_CAPACITY_KN)).toFixed(2),
  tubesPerEndLine,
  endTubeTensionUtilisation: +(P_DESIGN_KN / (tubesPerEndLine * N_tube_kN)).toFixed(2),
  endClampCapacity_kN: +endClampCapacity_kN.toFixed(2),
  clampsPerEndLine,
  c52AtMidspan: { moment_kNm: +M_c52_midspan_kNm.toFixed(2), capacity_kNm: +M_c52_cap_kNm.toFixed(2), ok: M_c52_midspan_kNm <= M_c52_cap_kNm },
  linesOnSecondRow: cleats.filter((c) => (c.row ?? 1) > 1).map((c) => c.code),
  longEdgeC52Used: Object.fromEntries(['bottom', 'top'].map((e) => [e, cleats.filter((c) => c.edge === e).length * clampsPerLine])),
  c52Count: beams.length
};

// ------------------------------------------------------------------ DXF (R12, mm)
const pair = (c, v) => `${c}\n${v}\n`;
const N = (v) => (Math.round(v * 100) / 100).toString();
const L = (layer, x0, y0, x1, y1) => pair(0, 'LINE') + pair(8, layer) + pair(10, N(x0)) + pair(20, N(y0)) + pair(30, 0) + pair(11, N(x1)) + pair(21, N(y1)) + pair(31, 0);
const C = (layer, x, y, r) => pair(0, 'CIRCLE') + pair(8, layer) + pair(10, N(x)) + pair(20, N(y)) + pair(30, 0) + pair(40, N(r));
const TX = (layer, x, y, hgt, s) => pair(0, 'TEXT') + pair(8, layer) + pair(10, N(x)) + pair(20, N(y)) + pair(30, 0) + pair(40, N(hgt)) + pair(1, s);
const R = (layer, x0, y0, x1, y1) => L(layer, x0, y0, x1, y0) + L(layer, x1, y0, x1, y1) + L(layer, x1, y1, x0, y1) + L(layer, x0, y1, x0, y0);
const LAYERS = [
  ['00_THAM_CHIEU_C52', 8], ['00_THAM_CHIEU_HANG_PHAO', 9], ['09_ONG_40X60_NEO', 5], ['09_ONG_40X60_GIANG', 4],
  ['10_MOC_CHU_KI', 2], ['10_BU_LONG_M10X120', 3], ['11_DIEM_NEO_CAP', 1], ['12_CHI_TIET_GHI_CHU', 7]
];
let ent = '';
for (const bm of beams) ent += L('00_THAM_CHIEU_C52', bm.x, bm.y0, bm.x, bm.y1);
for (const r of floatRows) ent += L('00_THAM_CHIEU_HANG_PHAO', xMin - 500, r, xMax + 500, r);
for (const tb of tubes) ent += R(tb.kind === 'anchor' ? '09_ONG_40X60_NEO' : '09_ONG_40X60_GIANG', tb.x0, tb.y - 30, tb.x1, tb.y + 30);
for (const k of clamps) ent += k.kind === 'clamp' ? R('10_MOC_CHU_KI', k.x - 60, k.y - 70, k.x + 60, k.y + 70) : C('10_BU_LONG_M10X120', k.x, k.y, 25);
for (const c of cleats) {
  ent += C('11_DIEM_NEO_CAP', c.x, c.y, 250) + TX('11_DIEM_NEO_CAP', c.x + 300, c.y + 300, 350, `${c.code} T=${T_LINE_KN}kN`);
  // bridle legs from the cleat to its clamps
  for (const k of clamps.filter((q) => q.line === c.code)) ent += L('11_DIEM_NEO_CAP', c.x, c.y, k.x, k.y);
}
// clamp detail (schematic section through a C52, looking along the C52) and notes, to the right of the plan
const dx = xMax + 6000, dy = yMax - 2000, s = 20; // detail enlarged 20:1
ent += TX('12_CHI_TIET_GHI_CHU', dx, dy + 2500, 400, 'CHI TIET LIEN KET ONG 40x60 - DAM C52 (TY LE PHONG 20:1, SO DO)');
ent += R('12_CHI_TIET_GHI_CHU', dx, dy - 52 * s, dx + 41 * s, dy); // C52 section
ent += R('09_ONG_40X60_NEO', dx - 60 * s, dy, dx + 100 * s, dy + 60 * s); // tube lying on the C52 (side view)
ent += L('10_MOC_CHU_KI', dx - 25 * s, dy, dx - 25 * s, dy + 64 * s) + L('10_MOC_CHU_KI', dx - 25 * s, dy + 64 * s, dx + 66 * s, dy + 64 * s) + L('10_MOC_CHU_KI', dx + 66 * s, dy + 64 * s, dx + 66 * s, dy)
  + L('10_MOC_CHU_KI', dx - 55 * s, dy, dx - 25 * s, dy) + L('10_MOC_CHU_KI', dx + 66 * s, dy, dx + 96 * s, dy);
ent += C('10_BU_LONG_M10X120', dx + 20 * s, dy + 70 * s, 5 * s) + C('10_BU_LONG_M10X120', dx - 40 * s, dy + 4 * s, 5 * s) + C('10_BU_LONG_M10X120', dx + 81 * s, dy + 4 * s, 5 * s);
const notes = [
  'Ong 40x60 dat tren dam C52, song song hang phao.',
  'ONG DUNG LAM DIEM NEO (mau xanh dam): moc chu KI tai MOI dam C52 = 1 bu long luc giac M10x120 (tren) + 2 bu long dai oc hinh thoi M10x30 (hai ben).',
  'ONG GIANG (mau xanh nhat): 1 bu long luc giac M10x120 tai moi dam C52, khong can moc.',
  `Luc keo thiet ke moi tuyen cap: ${T_LINE_KN} x ${GAMMA} = ${P_DESIGN_KN.toFixed(1)} kN.`,
  `KHONG moc cap vao MOT diem cua ong: mo men ${M_singlePoint_kNm.toFixed(1)} kNm, ong chi chiu duoc ${M_tube_kNm.toFixed(2)} kNm.`,
  `Moi tuyen cap phai chia qua dam phan tai / day chan vit toi ${clampsPerLine} moc (moi moc ${CLAMP_CAPACITY_KN} kN - GIA THIET, can so lieu nha cung cap phao).`,
  `Tuyen cap o dau hoi be (keo doc ong): ${tubesPerEndLine} ong moi tuyen, ${clampsPerEndLine} moc (moi moc ${endClampCapacity_kN.toFixed(1)} kN do dam C52 bi uon ngang).`,
  'BAN VE DE XUAT - phai duoc nha cung cap he phao xac nhan suc chiu cua moc, dam C52 va tai phao truoc khi thi cong.'
];
notes.forEach((nt, i) => { ent += TX('12_CHI_TIET_GHI_CHU', dx, dy - 2500 - i * 800, 350, nt); });
// title and bill of materials
ent += TX('12_CHI_TIET_GHI_CHU', xMin, yMax + 3500, 700, 'BE 1 - MAT BANG BO TRI ONG HOP 40x60 TREN DAM C52 (ban ve de xuat, don vi mm)');
const bomY = dy - 2500 - notes.length * 800 - 1500;
const bomRows = [
  ['BANG THONG KE VAT TU BE 1', ''],
  [`Ong hop 40x60x${TUBE.t} - ong neo`, `${bom.anchorTubes} thanh, ${bom.anchorTube_m} m`],
  [`Ong hop 40x60x${TUBE.t} - ong giang`, `${bom.braceTubes} tuyen, ${bom.braceTube_m} m`],
  ['Tong ong 40x60', `${bom.tubeTotal_m} m = ${bom.tubeStock6m} cay 6 m (gom 5% hao hut)`],
  ['Moc kep chu KI', `${bom.clamps_ki} cai`],
  ['Bu long luc giac M10x120', `${bom.hexBolt_M10x120} bo`],
  ['Bu long dai oc hinh thoi M10x30', `${bom.rhombusNutBolt_M10x30} bo`]
];
bomRows.forEach(([a, b2], i) => {
  const yy = bomY - i * 900;
  ent += TX('12_CHI_TIET_GHI_CHU', dx + 200, yy + 250, 350, a) + TX('12_CHI_TIET_GHI_CHU', dx + 13200, yy + 250, 350, b2);
  ent += L('12_CHI_TIET_GHI_CHU', dx, yy, dx + 30000, yy);
});
ent += L('12_CHI_TIET_GHI_CHU', dx, bomY + 900, dx + 30000, bomY + 900) + L('12_CHI_TIET_GHI_CHU', dx, bomY + 900, dx, bomY - (bomRows.length - 1) * 900)
  + L('12_CHI_TIET_GHI_CHU', dx + 30000, bomY + 900, dx + 30000, bomY - (bomRows.length - 1) * 900) + L('12_CHI_TIET_GHI_CHU', dx + 13000, bomY, dx + 13000, bomY - (bomRows.length - 1) * 900);
let table = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length + 1) + pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, 7) + pair(6, 'CONTINUOUS');
for (const [nm, col] of LAYERS) table += pair(0, 'LAYER') + pair(2, nm) + pair(70, 0) + pair(62, col) + pair(6, 'CONTINUOUS');
table += pair(0, 'ENDTAB');
const dxf = pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') + pair(9, '$INSUNITS') + pair(70, 4) + pair(0, 'ENDSEC')
  + pair(0, 'SECTION') + pair(2, 'TABLES') + table + pair(0, 'ENDSEC') + pair(0, 'SECTION') + pair(2, 'ENTITIES') + ent + pair(0, 'ENDSEC') + pair(0, 'EOF');

// ------------------------------------------------------------------ report
const fmt = (v, d = 1) => v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const report = `# BÈ 1 — Bố trí và kiểm tra ống hộp 40×60 đặt ngang trên dầm C52

Sinh bởi \`scripts/planRaft1Tubes.mjs\` từ bản vẽ \`${path.basename(dxfPath)}\`. Bản vẽ kèm theo: \`be1_ong_40x60.dxf\` (mm, cùng hệ tọa độ với bản vẽ gốc).

## 1. Số liệu đọc từ bản vẽ
- ${beams.length} dầm C52 chạy ngang qua các hàng phao (bản vẽ đặt tên block là "hOP 40X60", layer S-BEAM), bước xen kẽ 1,1 / 1,4 m, trung bình ${fmt(beamPitch, 2)} m.
- ${floatRows.length} hàng phao đỡ pin, bước ${FLOAT_ROW_PITCH_M} m.
- Kích thước lưới dầm: ${fmt((xMax - xMin) / 1000)} × ${fmt((yMax - yMin) / 1000)} m.

## 2. Tải trọng
- Lực căng thiết kế một tuyến cáp của BÈ 1: **T = ${T_LINE_KN} kN** (bộ tính toán của dự án, góc nghiêng 12°, V = 30 m/s).
- Hệ số tải trọng ${GAMMA} → lực tính toán **${fmt(P_DESIGN_KN)} kN** mỗi tuyến. BÈ 1 có ${cleats.length} tuyến cáp.

## 3. Sức chịu của cấu kiện
| Cấu kiện | Giá trị | Ghi chú |
|---|---|---|
| Ống 40×60×${TUBE.t} mm | A = ${fmt(A, 0)} mm², W = ${fmt(Wx / 1000, 2)} cm³ | Thép Q235 / SS400, f = ${TUBE.f_MPa} MPa — **giả định**, bản vẽ không ghi vật liệu và chiều dày |
| Ống chịu kéo dọc trục | ${fmt(N_tube_kN)} kN | |
| Ống chịu uốn | ${fmt(M_tube_kNm, 2)} kNm | |
| Một móc chữ 几 | ${CLAMP_CAPACITY_KN} kN | **GIẢ ĐỊNH**: 2 đai ốc hình thoi × 3,5 kN (trượt trong rãnh C52). Cần số liệu nhà cung cấp |
| Dầm C52 chịu uốn | ${fmt(M_c52_cap_kNm, 2)} kNm | **GIẢ ĐỊNH** W ≈ ${C52.W_cm3} cm³ |
| Bu lông M10 chịu cắt (1 mặt cắt) | ${fmt((58 * 160) / 1000)} kN | TCVN 5575:2012, cấp bền 4.8 (**giả định**), A_bn = 58 mm², f_vb = 160 MPa |
| Ép mặt bu lông M10 lên thành ống ${TUBE.t} mm | ${fmt((10 * TUBE.t * 395) / 1000)} kN | f_cb = 395 MPa (thép f_u ≈ 370 MPa). Cả hai đều lớn hơn 3,5 kN/đai ốc: liên kết bị khống chế bởi trượt đai ốc trong rãnh C52, không phải thân bu lông |
| Ống chịu cắt | ${fmt((2 * (h - 2 * t) * t * 0.58 * TUBE.f_MPa) / 1000)} kN | hai thành đứng, f_v = 0,58 f |

## 4. Kết quả kiểm tra
1. **Móc cáp vào MỘT điểm trên ống: KHÔNG ĐẠT.** Ống làm việc như dầm giữa hai dầm C52: M = ${fmt(M_singlePoint_kNm)} kNm, gấp **${fmt(M_singlePoint_kNm / M_tube_kNm, 0)} lần** khả năng chịu uốn ${fmt(M_tube_kNm, 2)} kNm. Kéo dài ống không giúp được: tải tập trung vẫn dồn vào hai móc gần nhất.
2. **Mỗi tuyến cáp cần ${clampsPerLine} móc chữ 几** (${fmt(P_DESIGN_KN)} / ${CLAMP_CAPACITY_KN} kN), mỗi móc trên một dầm C52. Cáp phải nối qua dầm phân tải hoặc dây chân vịt ${clampsPerLine} nhánh để mỗi móc nhận phần lực bằng nhau (hệ số sử dụng móc ${fmt(checks.clampUtilisation, 2)}).
3. **Mép dài của bè** (cáp kéo dọc theo dầm C52): mép dưới cần ${checks.longEdgeC52Used.bottom} móc, mép trên cần ${checks.longEdgeC52Used.top} móc, trong khi mỗi mép chỉ có ${beams.length} dầm C52. Một hàng móc không đủ chỗ: ${checks.linesOnSecondRow.length} tuyến (${checks.linesOnSecondRow.join(', ')}) phải đặt ống neo lùi vào hàng phao thứ hai, vì hai tuyến cạnh nhau không được dùng chung móc.
4. **Hai đầu hồi** (cáp kéo dọc theo ống): một ống chịu kéo được ${fmt(N_tube_kN)} kN < ${fmt(P_DESIGN_KN)} kN → **${tubesPerEndLine} ống mỗi tuyến** (hệ số sử dụng ${fmt(checks.endTubeTensionUtilisation, 2)}). Ở đây mỗi móc đẩy ngang dầm C52 tại vị trí cách hàng phao ${TUBE_OFFSET_FROM_FLOAT_ROW_M} m; dầm C52 chịu uốn chỉ cho phép **${fmt(endClampCapacity_kN)} kN mỗi móc**, nên mỗi tuyến đầu hồi cần **${clampsPerEndLine} móc**. (Đặt móc giữa hai hàng phao thì dầm C52 bị uốn ${fmt(M_c52_midspan_kNm, 2)} kNm > ${fmt(M_c52_cap_kNm, 2)} kNm.)

## 5. Bố trí
- **Ống neo** (layer \`09_ONG_40X60_NEO\`): ${bom.anchorTubes} thanh, ${fmt(bom.anchorTube_m)} m, có móc chữ 几 tại mọi dầm C52 nó đi qua.
- **Ống giằng** (layer \`09_ONG_40X60_GIANG\`): ${bom.braceTubes} tuyến chạy suốt bè, cách nhau ${BRACE_EVERY_ROWS * FLOAT_ROW_PITCH_M} m (mỗi ${BRACE_EVERY_ROWS} hàng phao) và ở hai hàng biên, ${fmt(bom.braceTube_m)} m, bắt 1 bu lông M10×120 tại mỗi dầm C52.
- Mọi ống đặt cách tim hàng phao ${TUBE_OFFSET_FROM_FLOAT_ROW_M} m, nơi dầm C52 được phao đỡ.

| Tuyến cáp | Loại | Mép bè | Số móc |
|---|---|---|---|
${cleats.map((c) => `| ${c.code} | ${c.type === 'SHORE' ? 'bờ' : 'đáy'} | ${({ bottom: 'dưới (dài)', top: 'trên (dài)', left: 'đầu hồi trái', right: 'đầu hồi phải' })[c.edge]} | ${c.clampCount} |`).join('\n')}

## 6. Bảng vật tư BÈ 1
| Vật tư | Số lượng |
|---|---|
| Ống hộp 40×60×${TUBE.t} | ${fmt(bom.tubeTotal_m)} m ≈ ${bom.tubeStock6m} cây 6 m (gồm 5 % hao hụt) |
| Móc kẹp chữ 几 | ${bom.clamps_ki} cái |
| Bu lông lục giác M10×120 | ${bom.hexBolt_M10x120} bộ |
| Bu lông đai ốc hình thoi M10×30 | ${bom.rhombusNutBolt_M10x30} bộ |

## 7. Giới hạn — phải đọc trước khi dùng
- Sức chịu của móc chữ 几, của dầm C52 và vật liệu ống là **giả định**. Mọi con số ở mục 4–6 tỷ lệ theo sức chịu của móc: nếu nhà cung cấp cho 14 kN/móc thì số móc mỗi tuyến giảm còn một nửa.
- Chưa kiểm tra: tai phao HDPE, liên kết dầm C52 với phao, dầm phân tải / dây chân vịt, mối nối ống, độ bền mỏi do sóng.
- Vị trí 19 điểm neo được quy đổi từ mặt bằng tổng thể (hệ tọa độ công trình, bè xoay 36°) sang bản vẽ bè theo tỷ lệ dọc hai cạnh; sai số cỡ 1–2 m dọc mép, không ảnh hưởng số lượng.
- Đây là phương án đề xuất. Nhà cung cấp hệ phao phải xác nhận trước khi thi công.
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'be1_ong_40x60.dxf'), dxf);
fs.writeFileSync(path.join(outDir, 'be1_ong_40x60.json'), JSON.stringify({ checks, bom, cleats, tubes, beams: beams.length, floatRows: floatRows.length }, null, 1));
fs.writeFileSync(path.join(outDir, 'BAO_CAO.md'), report);
console.log(JSON.stringify({ checks, bom, edges: cleats.map((c) => `${c.code}:${c.edge}:${c.clampCount}`) }, null, 1));
