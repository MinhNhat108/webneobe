const fs = require('fs');
const path = require('path');

const outDxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\BAN VE COC VEN BO VA BIEN PHAP THI CONG - HO HUOI VANH.dxf';
const projDxfPath = 'E:\\Out Job\\Chu Giap\\Hồ Huổi Vanh\\bè pin\\BAN VE COC VEN BO VA BIEN PHAP THI CONG - HO HUOI VANH.dxf';

// AutoCAD Color Index (ACI)
const ACI = {
  red: 1,      // Cốt thép chủ
  yellow: 2,   // Bản mã, tai neo, ghi chú
  green: 3,    // Địa hình, mực nước, taluy
  cyan: 4,     // Thân cọc, đường bao bê tông
  blue: 5,     // Cáp neo, ma-ní
  magenta: 6,  // Kích thước Dim
  white: 7,    // Khung tên, tiêu đề, chữ
  gray: 8      // Đường dóng, nét đứt, hatch
};

const LAYERS = [
  { name: '00_KHUNG_BAN_VE', color: ACI.white },
  { name: '01_DIA_HINH_TALUY', color: ACI.green },
  { name: '02_KET_CAU_COC', color: ACI.cyan },
  { name: '03_COT_THEP', color: ACI.red },
  { name: '04_BAN_MA_TAI_NEO', color: ACI.yellow },
  { name: '05_CAP_NEO_PHU_KIEN', color: ACI.blue },
  { name: '06_KICH_THUOC_DIM', color: ACI.magenta },
  { name: '07_CHU_THICH_TEXT', color: ACI.white },
  { name: '08_BIEN_PHAP_THI_CONG', color: ACI.yellow },
  { name: '09_NET_KHUAT_PHU', color: ACI.gray }
];

function toAsciiCad(input) {
  const map = {
    à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a', â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
    è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e', ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
    ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
    ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o', ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
    ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u', ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
    ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
    đ: 'd'
  };
  return input
    .split('')
    .map(ch => {
      const lower = ch.toLowerCase();
      const rep = map[lower];
      if (!rep) return ch;
      return ch === lower ? rep : rep.toUpperCase();
    })
    .join('')
    .replace(/[^\x20-\x7E]/g, '?');
}

function pair(code, val) {
  return `${code.toString().padStart(3, ' ')}\r\n${val}\r\n`;
}

function line(layer, x1, y1, x2, y2) {
  return pair(0, 'LINE') + pair(8, layer) +
    pair(10, x1.toFixed(3)) + pair(20, y1.toFixed(3)) + pair(30, '0.0') +
    pair(11, x2.toFixed(3)) + pair(21, y2.toFixed(3)) + pair(31, '0.0');
}

function circle(layer, cx, cy, r) {
  return pair(0, 'CIRCLE') + pair(8, layer) +
    pair(10, cx.toFixed(3)) + pair(20, cy.toFixed(3)) + pair(30, '0.0') +
    pair(40, r.toFixed(3));
}

function text(layer, x, y, h, str) {
  return pair(0, 'TEXT') + pair(8, layer) +
    pair(10, x.toFixed(3)) + pair(20, y.toFixed(3)) + pair(30, '0.0') +
    pair(40, h.toFixed(3)) +
    pair(1, toAsciiCad(str));
}

function rect(layer, x1, y1, x2, y2) {
  return line(layer, x1, y1, x2, y1) +
    line(layer, x2, y1, x2, y2) +
    line(layer, x2, y2, x1, y2) +
    line(layer, x1, y2, x1, y1);
}

function leader(layer, x1, y1, x2, y2, x3, y3, txt, txtH = 220) {
  let s = line(layer, x1, y1, x2, y2);
  s += line(layer, x2, y2, x3, y3);
  s += circle(layer, x1, y1, 30);
  const tx = x3 > x2 ? x3 + 50 : x3 - 50 - txt.length * txtH * 0.6;
  s += text(layer, tx, y3 + 40, txtH, txt);
  return s;
}

function dimH(layer, x1, x2, y, offset = 300, txt = null, txtH = 200) {
  const dy = y + offset;
  let s = line(layer, x1, y, x1, dy + 100);
  s += line(layer, x2, y, x2, dy + 100);
  s += line(layer, x1, dy, x2, dy);
  // Tick marks
  s += line(layer, x1 - 50, dy - 50, x1 + 50, dy + 50);
  s += line(layer, x2 - 50, dy - 50, x2 + 50, dy + 50);
  const midX = (x1 + x2) / 2;
  const label = txt || Math.round(Math.abs(x2 - x1)).toString();
  s += text(layer, midX - label.length * txtH * 0.3, dy + 50, txtH, label);
  return s;
}

function dimV(layer, x, y1, y2, offset = 300, txt = null, txtH = 200) {
  const dx = x + offset;
  let s = line(layer, x, y1, dx + 100, y1);
  s += line(layer, x, y2, dx + 100, y2);
  s += line(layer, dx, y1, dx, y2);
  // Tick marks
  s += line(layer, dx - 50, y1 - 50, dx + 50, y1 + 50);
  s += line(layer, dx - 50, y2 - 50, dx + 50, y2 + 50);
  const midY = (y1 + y2) / 2;
  const label = txt || Math.round(Math.abs(y2 - y1)).toString();
  s += text(layer, dx + 60, midY - txtH * 0.3, txtH, label);
  return s;
}

function buildDxf() {
  console.log('Generating Shore Pile & Construction Method CAD drawing...');
  let ents = '';

  // =========================================================================
  // 1. KHUNG BẢN VẼ A0 / SCALE TỔNG THỂ (60m x 40m = 60000 x 40000 mm)
  // =========================================================================
  ents += rect('00_KHUNG_BAN_VE', 0, 0, 60000, 40000);
  ents += rect('00_KHUNG_BAN_VE', 1000, 1000, 59000, 39000);

  // TIÊU ĐỀ LỚN TRÊN CÙNG
  ents += text('00_KHUNG_BAN_VE', 2000, 37500, 700, 'DU AN DIEN MAT TROI NOI HO HUOI VANH (CHU GIAP)');
  ents += text('00_KHUNG_BAN_VE', 2000, 36500, 600, 'HANG MUC: HE THONG NEO BE - CHI TIET COC KHOAN NHOI VEN BO D350 mm & BIEN PHAP THI CONG');
  ents += line('00_KHUNG_BAN_VE', 2000, 36100, 58000, 36100);

  // KHUNG TÊN (GÓC DƯỚI BÊN PHẢI)
  const kx1 = 43000, ky1 = 1000, kx2 = 59000, ky2 = 7000;
  ents += rect('00_KHUNG_BAN_VE', kx1, ky1, kx2, ky2);
  ents += line('00_KHUNG_BAN_VE', kx1, 5800, kx2, 5800);
  ents += line('00_KHUNG_BAN_VE', kx1, 4600, kx2, 4600);
  ents += line('00_KHUNG_BAN_VE', kx1, 3400, kx2, 3400);
  ents += line('00_KHUNG_BAN_VE', kx1, 2200, kx2, 2200);
  ents += line('00_KHUNG_BAN_VE', 49000, ky1, 49000, ky2);

  ents += text('00_KHUNG_BAN_VE', kx1 + 300, 6300, 250, 'CHU DAU TU:');
  ents += text('00_KHUNG_BAN_VE', 49500, 6300, 320, 'CHU GIAP');
  ents += text('00_KHUNG_BAN_VE', kx1 + 300, 5100, 250, 'CONG TRINH:');
  ents += text('00_KHUNG_BAN_VE', 49500, 5100, 300, 'DIEN MAT TROI NOI HO HUOI VANH');
  ents += text('00_KHUNG_BAN_VE', kx1 + 300, 3900, 250, 'HANG MUC:');
  ents += text('00_KHUNG_BAN_VE', 49500, 3900, 260, 'HE NEO - COC VEN BO & BP THI CONG');
  ents += text('00_KHUNG_BAN_VE', kx1 + 300, 2700, 250, 'NGAY LAP:');
  ents += text('00_KHUNG_BAN_VE', 49500, 2700, 260, 'THANG 10 / 2026');
  ents += text('00_KHUNG_BAN_VE', kx1 + 300, 1500, 250, 'KY HIEU BAN VE:');
  ents += text('00_KHUNG_BAN_VE', 49500, 1500, 350, 'BV-NEO-BO-01');

  // =========================================================================
  // ZONE 1: HÌNH 1 - MẶT CẮT ĐỊA HÌNH TALUY VEN BỜ & SƠ ĐỒ BỐ TRÍ CỌC (SCALE 1:50)
  // Tọa độ: X [2000, 28000], Y [21000, 35500]
  // =========================================================================
  ents += text('07_CHU_THICH_TEXT', 2500, 35000, 450, 'HINH 1: MAT CAT DIA HINH TALUY VEN BO & SO DO BO TRI COC D350');
  ents += text('07_CHU_THICH_TEXT', 2500, 34300, 250, '(Ty le 1:50 - Do doc taluy tu nhien 25 do - 30 do, dao dong muc nuoc ho 6.0 m)');

  // Đường dốc taluy tự nhiên
  const slopePts = [
    [2500, 33500],
    [5000, 32000],
    [8000, 30500],
    [11000, 29000],
    [14000, 27500],
    [18000, 25500],
    [22000, 23500],
    [27000, 22500]
  ];
  for (let i = 0; i < slopePts.length - 1; i++) {
    ents += line('01_DIA_HINH_TALUY', slopePts[i][0], slopePts[i][1], slopePts[i+1][0], slopePts[i+1][1]);
  }
  ents += text('01_DIA_HINH_TALUY', 4000, 32800, 240, 'Mai doc taluy dat tu nhien (i = 25 - 30 deg)');

  // Lớp địa chất 1 (Lớp phủ sườn tích dày 1.5m)
  for (let i = 0; i < slopePts.length - 1; i++) {
    ents += line('09_NET_KHUAT_PHU', slopePts[i][0], slopePts[i][1] - 1500, slopePts[i+1][0], slopePts[i+1][1] - 1500);
  }
  ents += text('07_CHU_THICH_TEXT', 3500, 30500, 220, 'Lop 1: Dat suon tich a set lan dam san (day 1.0 - 1.5 m)');
  ents += text('07_CHU_THICH_TEXT', 3500, 28000, 220, 'Lop 2: Da phong hoa nut ne / set ket cung (tang ngam coc chiu luc)');

  // Mực nước hồ
  // MNDBT = +386.00 m tại y = 26500
  ents += line('01_DIA_HINH_TALUY', 16000, 26500, 27500, 26500);
  ents += text('01_DIA_HINH_TALUY', 21000, 26800, 260, 'MNDBT: +386.00 m (Muc nuoc dang binh thuong)');
  // Ký hiệu tam giác mực nước
  ents += line('01_DIA_HINH_TALUY', 20500, 26500, 20300, 26900);
  ents += line('01_DIA_HINH_TALUY', 20300, 26900, 20700, 26900);
  ents += line('01_DIA_HINH_TALUY', 20700, 26900, 20500, 26500);

  // MNC = +380.00 m tại y = 24000
  ents += line('09_NET_KHUAT_PHU', 21000, 24000, 27500, 24000);
  ents += text('09_NET_KHUAT_PHU', 22000, 24300, 240, 'MNC: +380.00 m (Muc nuoc chet, dH = 6.0 m)');

  // CỌC KHOAN NHỒI VEN BỜ D350 ĐIỂN HÌNH TẠI TIM X = 9500, Y ĐỈNH = 29750
  const px = 9500, pyTop = 29750, pDia = 350, pLen = 7000;
  // Thân cọc D350 khoan thẳng đứng (hoặc hơi xiên)
  ents += line('02_KET_CAU_COC', px - pDia / 2, pyTop, px - pDia / 2, pyTop - pLen);
  ents += line('02_KET_CAU_COC', px + pDia / 2, pyTop, px + pDia / 2, pyTop - pLen);
  ents += line('02_KET_CAU_COC', px - pDia / 2, pyTop - pLen, px + pDia / 2, pyTop - pLen);
  // Mũ cọc 400x400
  ents += rect('02_KET_CAU_COC', px - 200, pyTop - 300, px + 200, pyTop + 20);
  // Bản mã 400x400x20
  ents += rect('04_BAN_MA_TAI_NEO', px - 200, pyTop + 20, px + 200, pyTop + 40);
  // Tai neo cao 180
  ents += rect('04_BAN_MA_TAI_NEO', px - 15, pyTop + 40, px + 15, pyTop + 220);
  ents += circle('04_BAN_MA_TAI_NEO', px, pyTop + 140, 20); // Lỗ xỏ ma-ní

  // Ma-ní & Tuyến cáp neo kéo xiên về phía bè (góc 14 độ)
  ents += circle('05_CAP_NEO_PHU_KIEN', px + 60, pyTop + 140, 35); // Ma-ní
  ents += line('05_CAP_NEO_PHU_KIEN', px + 95, pyTop + 140, 27500, 29750 + 140 - (27500 - px) * Math.tan(14 * Math.PI / 180));
  ents += text('05_CAP_NEO_PHU_KIEN', 14000, 29300, 250, 'Cap neo ve be pin (PES-48, goc keo xiên 12 - 15 deg)');

  // Dim cọc trên hình 1
  ents += dimV('06_KICH_THUOC_DIM', px - pDia / 2, pyTop - pLen, pyTop, -1000, 'L = 7.0 m');
  ents += leader('06_KICH_THUOC_DIM', px + pDia / 2, pyTop - 4000, px + 2500, pyTop - 4000, px + 3500, pyTop - 4000, 'Coc khoan nhoi D350 mm (Be tong B25)', 240);
  ents += leader('06_KICH_THUOC_DIM', px, pyTop + 140, px - 2000, pyTop + 1200, px - 3500, pyTop + 1200, 'Dau coc nho e <= 100 mm (bat buoc)', 240);

  // Phao bè pin minh họa phía xa trên mặt nước
  ents += rect('01_DIA_HINH_TALUY', 24000, 26400, 27500, 26900);
  ents += text('01_DIA_HINH_TALUY', 24200, 27100, 240, 'Mang phao be pin noi');

  // =========================================================================
  // ZONE 2: HÌNH 2 - CHI TIẾT CẤU TẠO ĐẦU CỌC & TAI NEO CÁP (SCALE 1:10)
  // Tọa độ: X [2000, 28000], Y [9000, 20000]
  // =========================================================================
  ents += text('07_CHU_THICH_TEXT', 2500, 19500, 450, 'HINH 2: CHI TIET CAU TAO DAU COC D350 & TAI NEO CAP (TY LE 1:10)');
  ents += line('00_KHUNG_BAN_VE', 2000, 20200, 28500, 20200);

  // --- HÌNH 2.1: MẶT ĐỨNG CẮT DỌC ĐỈNH CỌC (PHƯƠNG CÁP KÉO) ---
  const cx1 = 7500, cy1 = 13500;
  ents += text('07_CHU_THICH_TEXT', cx1 - 2500, 18500, 320, '2.1. MAT DUNG CAT DOC (Theo phuong cap keo)');

  // Mặt đất tự nhiên
  ents += line('01_DIA_HINH_TALUY', cx1 - 2000, cy1, cx1 - 400, cy1);
  ents += line('01_DIA_HINH_TALUY', cx1 + 400, cy1, cx1 + 2500, cy1);
  ents += text('01_DIA_HINH_TALUY', cx1 + 1200, cy1 + 80, 180, 'Mat dat tu nhien');

  // Thân cọc D350 (vẽ to tỷ lệ thật theo mm: D=350, bán kính r=175)
  // Phóng to gấp 2 lần cho bản vẽ cực kỳ rõ nét và dễ nhìn (Scale 2:1 trong ô chi tiết):
  const sc = 2.5; // Hệ số phóng trực quan chi tiết
  const r350 = 175 * sc;
  const hCollar = 300 * sc;
  const wCollar = 200 * sc; // nửa bề rộng mũ cọc 400
  const tPlate = 20 * sc;
  const hLug = 180 * sc;
  const wLug = 100 * sc; // nửa chiều rộng tai neo 200
  const holePin = 100 * sc; // tim chốt cách bản mã 60mm -> 100mm từ mặt đất

  // Thân cọc bê tông D350
  ents += line('02_KET_CAU_COC', cx1 - r350, cy1 - hCollar, cx1 - r350, cy1 - 2500);
  ents += line('02_KET_CAU_COC', cx1 + r350, cy1 - hCollar, cx1 + r350, cy1 - 2500);
  ents += line('09_NET_KHUAT_PHU', cx1 - r350 - 50, cy1 - 2500, cx1 + r350 + 50, cy1 - 2500); // vệt cắt gãy

  // Mũ cọc bê tông 400x400x300
  ents += rect('02_KET_CAU_COC', cx1 - wCollar, cy1 - hCollar, cx1 + wCollar, cy1 + 20 * sc);

  // Bản mã đỉnh cọc 400x400x20
  ents += rect('04_BAN_MA_TAI_NEO', cx1 - wCollar, cy1 + 20 * sc, cx1 + wCollar, cy1 + 20 * sc + tPlate);

  // Râu neo bản mã 4D22 cắm 600mm
  const rAnchorX = 90 * sc;
  ents += line('03_COT_THEP', cx1 - rAnchorX, cy1 + 20 * sc, cx1 - rAnchorX, cy1 - 600 * sc);
  ents += line('03_COT_THEP', cx1 - rAnchorX, cy1 - 600 * sc, cx1 - rAnchorX - 100, cy1 - 600 * sc); // móc bẻ
  ents += line('03_COT_THEP', cx1 + rAnchorX, cy1 + 20 * sc, cx1 + rAnchorX, cy1 - 600 * sc);
  ents += line('03_COT_THEP', cx1 + rAnchorX, cy1 - 600 * sc, cx1 + rAnchorX + 100, cy1 - 600 * sc);

  // Tai neo cáp (Padeye) dày 25, cao 180, dài 200
  const yPlateTop = cy1 + 20 * sc + tPlate;
  ents += line('04_BAN_MA_TAI_NEO', cx1 - wLug, yPlateTop, cx1 + wLug, yPlateTop);
  ents += line('04_BAN_MA_TAI_NEO', cx1 - wLug, yPlateTop, cx1 - wLug, yPlateTop + hLug * 0.7);
  ents += line('04_BAN_MA_TAI_NEO', cx1 + wLug, yPlateTop, cx1 + wLug, yPlateTop + hLug * 0.7);
  // Cung bo tròn đỉnh tai neo
  ents += line('04_BAN_MA_TAI_NEO', cx1 - wLug, yPlateTop + hLug * 0.7, cx1 - wLug * 0.5, yPlateTop + hLug);
  ents += line('04_BAN_MA_TAI_NEO', cx1 + wLug, yPlateTop + hLug * 0.7, cx1 + wLug * 0.5, yPlateTop + hLug);
  ents += line('04_BAN_MA_TAI_NEO', cx1 - wLug * 0.5, yPlateTop + hLug, cx1 + wLug * 0.5, yPlateTop + hLug);

  // Lỗ xỏ ma-ní D39
  const yHole = yPlateTop + 60 * sc; // tim lỗ cách bản mã 60mm
  ents += circle('04_BAN_MA_TAI_NEO', cx1, yHole, (39 / 2) * sc);

  // Ma-ní móng ngựa WLL 12T (chốt phi 35) & cáp kéo xiên
  ents += circle('05_CAP_NEO_PHU_KIEN', cx1 + 50 * sc, yHole, 45 * sc);
  ents += line('05_CAP_NEO_PHU_KIEN', cx1 + 95 * sc, yHole, cx1 + 800 * sc, yHole - 180 * sc); // Cáp xiên

  // Kích thước Dim & Leader
  ents += dimV('06_KICH_THUOC_DIM', cx1 - wCollar, cy1, yHole, -350, 'e = 100 mm (TIM CHOT)', 180);
  ents += dimH('06_KICH_THUOC_DIM', cx1 - wCollar, cx1 + wCollar, yPlateTop, 200, '400', 160);
  ents += dimV('06_KICH_THUOC_DIM', cx1 + wCollar, yPlateTop - tPlate, yPlateTop, 300, '20', 160);
  ents += dimV('06_KICH_THUOC_DIM', cx1 + wCollar, cy1 - 600 * sc, yPlateTop - tPlate, 600, 'L_neo = 600 mm', 180);

  ents += leader('06_KICH_THUOC_DIM', cx1 + wCollar, yPlateTop - tPlate / 2, cx1 + 1200, yPlateTop + 200, cx1 + 2200, yPlateTop + 200, 'Ban ma thep 400x400x20 mm (SS400)', 200);
  ents += leader('06_KICH_THUOC_DIM', cx1 + wLug, yPlateTop + hLug * 0.5, cx1 + 1200, yPlateTop + hLug * 0.8, cx1 + 2400, yPlateTop + hLug * 0.8, 'Tai neo t=25 mm, lo D39, han goc hf=10', 200);
  ents += leader('06_KICH_THUOC_DIM', cx1 + 60 * sc, yHole, cx1 + 1400, yHole + 400, cx1 + 2500, yHole + 400, 'Ma-ni mong ngua WLL 12T, chot D35 mm', 200);
  ents += leader('06_KICH_THUOC_DIM', cx1 - rAnchorX, cy1 - 300 * sc, cx1 - 1200, cy1 - 300 * sc, cx1 - 2500, cy1 - 300 * sc, '4 rau neo thep 4D22 CB400-V cắm 600 mm', 200);

  // --- HÌNH 2.2: MẶT BẰNG ĐỈNH CỌC ---
  const cx2 = 21000, cy2 = 14500;
  ents += text('07_CHU_THICH_TEXT', cx2 - 2500, 18500, 320, '2.2. MAT BANG DINH COC');

  // Thân cọc D350 nét đứt bên dưới
  ents += circle('09_NET_KHUAT_PHU', cx2, cy2, r350);
  // Bản mã 400x400
  ents += rect('04_BAN_MA_TAI_NEO', cx2 - wCollar, cy2 - wCollar, cx2 + wCollar, cy2 + wCollar);

  // Tai neo t=25 đặt theo phương cáp kéo (phương ngang)
  ents += rect('04_BAN_MA_TAI_NEO', cx2 - wLug, cy2 - (25 / 2) * sc, cx2 + wLug, cy2 + (25 / 2) * sc);
  // 2 sườn gia cường tam giác dày 12mm
  ents += line('04_BAN_MA_TAI_NEO', cx2 - wLug * 0.6, cy2 + (25 / 2) * sc, cx2 - wLug * 0.6, cy2 + (75 / 2) * sc);
  ents += line('04_BAN_MA_TAI_NEO', cx2 + wLug * 0.6, cy2 + (25 / 2) * sc, cx2 + wLug * 0.6, cy2 + (75 / 2) * sc);
  ents += line('04_BAN_MA_TAI_NEO', cx2 - wLug * 0.6, cy2 - (25 / 2) * sc, cx2 - wLug * 0.6, cy2 - (75 / 2) * sc);
  ents += line('04_BAN_MA_TAI_NEO', cx2 + wLug * 0.6, cy2 - (25 / 2) * sc, cx2 + wLug * 0.6, cy2 - (75 / 2) * sc);

  // 4 râu neo trên ô vuông 180x180
  const sbX = 90 * sc;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ents += circle('03_COT_THEP', cx2 + sx * sbX, cy2 + sy * sbX, (22 / 2) * sc);
    }
  }

  // Phương cáp kéo mũi tên
  ents += line('05_CAP_NEO_PHU_KIEN', cx2 + wLug, cy2, cx2 + wLug + 600, cy2);
  ents += line('05_CAP_NEO_PHU_KIEN', cx2 + wLug + 600, cy2, cx2 + wLug + 450, cy2 + 100);
  ents += line('05_CAP_NEO_PHU_KIEN', cx2 + wLug + 600, cy2, cx2 + wLug + 450, cy2 - 100);
  ents += text('05_CAP_NEO_PHU_KIEN', cx2 + wLug + 100, cy2 + 150, 180, 'Phuong keo cap');

  ents += dimH('06_KICH_THUOC_DIM', cx2 - wCollar, cx2 + wCollar, cy2 + wCollar, 200, '400', 160);
  ents += dimV('06_KICH_THUOC_DIM', cx2 + wCollar, cy2 - wCollar, cy2 + wCollar, 200, '400', 160);
  ents += dimH('06_KICH_THUOC_DIM', cx2 - sbX, cx2 + sbX, cy2 - wCollar, -200, '180', 160);

  // =========================================================================
  // ZONE 3: HÌNH 3 - CHI TIẾT MẶT CẮT THÂN CỌC & LỒNG CỐT THÉP (SCALE 1:5)
  // Tọa độ: X [2000, 28000], Y [1500, 8500]
  // =========================================================================
  ents += line('00_KHUNG_BAN_VE', 2000, 8800, 28500, 8800);
  ents += text('07_CHU_THICH_TEXT', 2500, 8200, 450, 'HINH 3: MAT CAT THAN COC & LONG COT THEP D350 (TY LE 1:5)');

  // 3.1 Mặt cắt ngang thân cọc tròn D350
  const sx1 = 8000, sy1 = 4500;
  const scSec = 4.0; // Phóng to chi tiết thân cọc
  const rSec = 175 * scSec; // Bán kính 175mm phóng to
  const cCover = 35 * scSec; // Lớp bảo vệ 35mm

  ents += circle('02_KET_CAU_COC', sx1, sy1, rSec); // Bê tông cọc D350
  ents += circle('03_COT_THEP', sx1, sy1, rSec - cCover); // Vòng đai xoắn D8

  // Bố trí 6 thanh thép chủ phi 28 đều trên vòng tròn
  const rRebarRing = rSec - cCover - (28 / 2) * scSec;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60) * Math.PI / 180;
    const bx = sx1 + rRebarRing * Math.cos(angle);
    const by = sy1 + rRebarRing * Math.sin(angle);
    ents += circle('03_COT_THEP', bx, by, (28 / 2) * scSec);
  }

  // 4 con kê bê tông tròn dày 35mm
  for (let i = 0; i < 4; i++) {
    const angle = (i * 90 + 45) * Math.PI / 180;
    const kx = sx1 + (rSec - cCover / 2) * Math.cos(angle);
    const ky = sy1 + (rSec - cCover / 2) * Math.sin(angle);
    ents += circle('09_NET_KHUAT_PHU', kx, ky, 8 * scSec);
  }

  ents += text('07_CHU_THICH_TEXT', sx1 - 1500, sy1 - rSec - 300, 240, 'MAT CAT 1-1: THAN COC D350');
  ents += leader('06_KICH_THUOC_DIM', sx1 + rSec, sy1, sx1 + 1500, sy1 + 500, sx1 + 2500, sy1 + 500, 'Be tong B25 (C20/25), D = 350 mm', 200);
  ents += leader('06_KICH_THUOC_DIM', sx1 + rRebarRing * Math.cos(Math.PI/3), sy1 + rRebarRing * Math.sin(Math.PI/3), sx1 + 1500, sy1 + 1200, sx1 + 2700, sy1 + 1200, 'Thep chu: 6D28 CB400-V chia deu vong tron', 200);
  ents += leader('06_KICH_THUOC_DIM', sx1, sy1 + rSec - cCover, sx1 - 1200, sy1 + 1200, sx1 - 2500, sy1 + 1200, 'Dai xoan D8 a150 (dau coc a100)', 200);
  ents += leader('06_KICH_THUOC_DIM', sx1, sy1 - rSec + cCover / 2, sx1 - 1200, sy1 - 800, sx1 - 2500, sy1 - 800, 'Con ke be tong tron c = 35 mm', 200);

  // 3.2 Bảng tóm tắt thông số cốt thép 1 cọc bờ L=7m
  const tx1 = 16000, ty1 = 7000;
  ents += text('07_CHU_THICH_TEXT', tx1, ty1, 260, 'BANG TONG HOP VAT TU 01 COC BO D350 (L = 7.0 m):');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 400, 200, '1. Be tong B25: 0.72 m3 (than coc 0.67 m3 + mu coc 0.05 m3)');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 750, 200, '2. Thep chu 6D28 CB400-V (L=7.2m): 6 cay x 34.8 kg = 35.2 kg');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 1100, 200, '3. Thep dai xoan D8 a150 (CB240-T): 8.5 kg');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 1450, 200, '4. Rau neo ban ma 4D22 CB400-V (L=0.7m): 7.2 kg');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 1800, 200, '5. Ban ma dinh coc 400x400x20 mm (SS400): 25.1 kg');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 2150, 200, '6. Tai neo t=25 mm kem 2 suon tang cuong: 5.8 kg');
  ents += text('07_CHU_THICH_TEXT', tx1, ty1 - 2500, 200, '7. Ma-ni mong ngua ma kem WLL 12T (chot D35): 01 bo');

  // =========================================================================
  // ZONE 4: HÌNH 4 - SƠ ĐỒ TRÌNH TỰ 6 BƯỚC THI CÔNG TRÊN BỜ DỐC TALUY
  // Tọa độ: X [29500, 58000], Y [21000, 35500]
  // =========================================================================
  ents += line('00_KHUNG_BAN_VE', 29000, 1000, 29000, 36100);
  ents += text('07_CHU_THICH_TEXT', 30000, 35000, 450, 'HINH 4: SO DO TRINH TU 6 BUOC THI CONG COC KHOAN NHOI BO DOC TALUY');

  const steps = [
    {
      num: 'BUOC 1: TRAC DAC & MAT BANG',
      desc1: '- Dinh vi tim coc bang may toan dac.',
      desc2: '- Bat taluy cuc bo tao san thao tac 2x2m.',
      desc3: '- Neo toi an toan tren dinh doi.'
    },
    {
      num: 'BUOC 2: KHOAN & HA ONG VACH',
      desc1: '- Dua may khoan mini (2-4T) vao vi tri.',
      desc2: '- Ha ong vach thep D380 dai 1.5 - 2.0m.',
      desc3: '- Khoan xoay D350 den do sau L = 7.0m.'
    },
    {
      num: 'BUOC 3: VET MUN & KIEM TRA',
      desc1: '- Vet sach cặn lang day ho khoan (<=50mm).',
      desc2: '- Kiem tra chieu sau bang thuoc day.',
      desc3: '- Kiem tra do nghieng truc coc <= 1%.'
    },
    {
      num: 'BUOC 4: HA LONG THEP & RAU NEO',
      desc1: '- Ha long thep D350 co san con ke c=35mm.',
      desc2: '- Treo neo long thep co dinh o mieng lo.',
      desc3: '- Dinh vi cum 4 rau neo 4D22 cam 600mm.'
    },
    {
      num: 'BUOC 5: DO BE TONG TREMIE',
      desc1: '- Do be tong B25 qua ong tremie tu day.',
      desc2: '- Rut dan ong vach tam theo muc be tong.',
      desc3: '- Do be tong dang cao hon mat dat 20-30cm.'
    },
    {
      num: 'BUOC 6: HOAN THIEN & MOC CAP',
      desc1: '- Duc tay be tong dau coc den e <= 100mm.',
      desc2: '- Do mu coc 400x400, lap ban ma & tai neo.',
      desc3: '- Son chong gi 3 lop, moc ma-ni WLL 12T.'
    }
  ];

  // Vẽ 6 khung bước thi công dạng lưới 2 cột x 3 hàng
  for (let idx = 0; idx < steps.length; idx++) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const bx = 30000 + col * 14200;
    const by = 30500 - row * 4300;
    const bw = 13500, bh = 3700;

    ents += rect('08_BIEN_PHAP_THI_CONG', bx, by, bx + bw, by + bh);
    ents += text('08_BIEN_PHAP_THI_CONG', bx + 300, by + bh - 600, 300, steps[idx].num);
    ents += line('08_BIEN_PHAP_THI_CONG', bx, by + bh - 850, bx + bw, by + bh - 850);
    ents += text('07_CHU_THICH_TEXT', bx + 400, by + bh - 1400, 220, steps[idx].desc1);
    ents += text('07_CHU_THICH_TEXT', bx + 400, by + bh - 2100, 220, steps[idx].desc2);
    ents += text('07_CHU_THICH_TEXT', bx + 400, by + bh - 2800, 220, steps[idx].desc3);

    // Mũi tên liên kết bước
    if (idx < steps.length - 1 && col === 0) {
      ents += line('08_BIEN_PHAP_THI_CONG', bx + bw, by + bh / 2, bx + bw + 700, by + bh / 2);
    }
  }

  // =========================================================================
  // ZONE 5: BẢNG 5 - THUYẾT MINH & GHI CHÚ BIỆN PHÁP THI CÔNG CHI TIẾT
  // Tọa độ: X [29500, 42000], Y [1500, 20500]
  // =========================================================================
  ents += line('00_KHUNG_BAN_VE', 29000, 21000, 59000, 21000);
  ents += text('07_CHU_THICH_TEXT', 30000, 20200, 420, 'BANG GHI CHU & THUYET MINH BIEN PHAP THI CONG');

  const notes = [
    'I. QUY DINH VAT LIEU:',
    '1. Be tong than coc: Be tong thuong pham cap do ben B25 (C20/25), R28 >= 25 MPa, da 1x2, do sut 16 +/- 2 cm.',
    '   Su dung xi mang pooc-lang ben sunfat de chong xam thuc cua moi truong nuoc ho nui.',
    '2. Cot thep: Thep chu dung thep thanh van CB400-V (Rs = 350 MPa). Thep dai dung thep tron tron CB240-T.',
    '3. Ban ma va tai neo: Thep tam ket cau SS400 hoac Q235B (fy = 235 MPa). Que han dien E43 hoac E51, duong han hf >= 10 mm.',
    '4. Son chong an mon: He son 3 lop (Lot giau kem Epoxy 60 um + Trung gian Epoxy 100 um + Phu PU 50 um), tong chieu day >= 210 um.',
    '5. Phu kien neo: Ma-ni mong ngua ma kem nhung nong tieu chuan WLL 12T (chot D35 mm), he so an toan SF >= 5.0.',
    '',
    'II. TIEU CHUAN THI CONG VA NGHIEM THU AP DUNG:',
    '- TCVN 9395:2012: Coc khoan nhoi - Tieu chuan thi cong va nghiem thu.',
    '- TCVN 10304:2014: Mong coc - Tieu chuan thiet ke.',
    '- TCVN 5574:2018: Thiet ke ket cau be tong va be tong cot thep.',
    '- TCVN 8789:2011: Son bao ve ket cau thep - Quy trinh thi cong va kiem tra.',
    '',
    'III. KIEM SOAT SAI SO THI CONG VA CHAT LUONG (RAT QUAN TRONG):',
    '1. Sai so tim coc tren mat bang: Khong vuot qua +/- 50 mm so voi toa do thiet ke.',
    '2. Do nghieng truc coc: Khong vuot qua 1% chieu sau coc.',
    '3. Cao do tim chot tai neo so voi mat dat tu nhien: e <= 100 mm (BAT BUOC TUAN THU).',
    '   CANH BAO: Neu de dau coc nho cao hon 100 mm se lam tang canh tay don uon, dan den qua tai cot thep coc.',
    '4. Chieu day lop mun lang day ho khoan truoc khi do be tong: Khong vuot qua 50 mm.',
    '',
    'IV. AN TOAN LAO DONG VA BAO VE MOI TRUONG HO HUOI VANH:',
    '1. Bo doc taluy ho doc 25 - 30 do, de trơn truot khi troi mua. May khoan thi cong tren suon doi bat buoc phai co',
    '   day cap toi phu neo giu vao cac diem tua an toan tren dinh doi (goc cay lon hoac coc neo phu).',
    '2. Cong nhan lam viec tren mai doc phai deo day an toan gan vao day cuu sinh doc lap; trang bi day du ao phao cuu sinh.',
    '3. Tuyet doi khong xa bun khoan va nuoc thai truc tiep xuong long ho. Phai bo tri ho lang bun tam thoi,',
    '   thu gom bun kho van chuyen den bai thai dung quy dinh bao ve nguon nuoc long ho.'
  ];

  let ny = 19400;
  for (const lineStr of notes) {
    if (lineStr.startsWith('I.') || lineStr.startsWith('II.') || lineStr.startsWith('III.') || lineStr.startsWith('IV.')) {
      ents += text('08_BIEN_PHAP_THI_CONG', 30000, ny, 260, lineStr);
      ny -= 450;
    } else if (lineStr.includes('CANH BAO') || lineStr.includes('BAT BUOC')) {
      ents += text('03_COT_THEP', 30000, ny, 220, lineStr);
      ny -= 400;
    } else {
      ents += text('07_CHU_THICH_TEXT', 30000, ny, 210, lineStr);
      ny -= 380;
    }
  }

  // =========================================================================
  // HOÀN THÀNH TÀI LIỆU DXF R12
  // =========================================================================
  let layerTableStr = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length + 1);
  layerTableStr += pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, ACI.white) + pair(6, 'CONTINUOUS');
  for (const l of LAYERS) {
    layerTableStr += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
  }
  layerTableStr += pair(0, 'ENDTAB');

  const fullDxf = pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$ACADVER') + pair(1, 'AC1009') +
    pair(9, '$INSUNITS') + pair(70, 4) + // 4 = mm
    pair(9, '$MEASUREMENT') + pair(70, 1) +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'TABLES') +
    layerTableStr +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'ENTITIES') +
    ents +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF');

  fs.mkdirSync(path.dirname(outDxfPath), { recursive: true });
  fs.writeFileSync(outDxfPath, fullDxf, { encoding: 'latin1' });
  console.log('Saved Shore Pile DXF to Desktop:', outDxfPath);

  fs.mkdirSync(path.dirname(projDxfPath), { recursive: true });
  fs.writeFileSync(projDxfPath, fullDxf, { encoding: 'latin1' });
  console.log('Saved Shore Pile DXF to Project:', projDxfPath);
}

buildDxf();
