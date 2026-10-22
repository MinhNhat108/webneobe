"""
Bảng thống kê vật tư BÈ PIN hồ Bản Mòng, cùng khuôn với bảng của Huổi Vanh
("HỒ HUỔI VANH_THỐNG KÊ VẬT TƯ BÈ PIN VÀ CẤU KIỆN BÈ PIN.xlsx"):

  python scripts/buildBanMongRaftBOQ.py <bản vẽ bè pin .pdf> <bảng neo Bản Mòng .xlsx> <mẫu Huổi Vanh .xlsx> <out.xlsx>

- Số tấm pin, phao, inverter, dầm C52, hộp 40x60: lấy NGUYÊN bảng thống kê trên
  từng tờ CT-BP-01…08 của bản vẽ "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG.pdf" (script
  kiểm tra lại từng số có trong chữ của tờ đó).
- Bản vẽ chỉ thể hiện đoạn thép lộ giữa các phao nên KHÔNG đo được từng thanh
  (trừ bè 5, tờ duy nhất vẽ thép bằng nét dày: 32 dầm × 113,05 m, 20 hộp × 39,2 m,
  khớp bảng tới 0,1 m). Số cây cấp hàng, mối nối, bulông là ƯỚC LƯỢNG bằng
  công thức Excel theo hệ số ở sheet GiaDinh (đo trên bè 5).
- Bản vẽ CHƯA có hộp 40x60 gia cường tai neo: ước tính cho cả 8 bè theo đúng
  cách của Huổi Vanh (cáp 2 nhánh chữ Y, 2 bích mỗi dây), vị trí dây theo mặt
  bằng neo của web (mặt bằng bè 22/10 nhập từ tờ MB-B01-01), lực dây T theo
  sheet KiemTra_Nhanh của bảng neo.
- Đường bao từng bè đo trên ảnh tờ bản vẽ (sheet DoiChieu_MatBang) để so với
  mặt bằng mà web dùng tính neo.
Hình minh họa ở cột C chép từ file mẫu Huổi Vanh theo tên hạng mục.
"""
import io, json, math, sys
from pathlib import Path

import cv2
import numpy as np
import openpyxl
import pymupdf
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from xlsx_apply_flags import add_apply_flags

ROOT = Path(__file__).resolve().parent.parent
PDF, MOORING_XLSX, TEMPLATE, OUT = sys.argv[1:5]
RAFTS = [f'BÈ {i}' for i in range(1, 9)]

# ------------------------------------------------------------------ drawing tables (tờ CT-BP-01…08, MB-B01-01)
# page, scale, panels, rows of panels, strings, inverters SG-510HX,
# support floats (count, rows), walkway float lines [(count, rows)…], C52 (bars, m), box 40x60 (bars, m)
SHEETS = {
    'BÈ 1': dict(page=1, scale=500, pv=2352, dpv=84, strings='84', inv=3, fs=(2408, 86), fw=[(338, 2), (233, 1)], c52=(118, '10103.04'), box=(21, '2278.28'), total=2979),
    'BÈ 2': dict(page=2, scale=500, pv=2380, dpv=98, strings='85', inv=3, fs=(2422, 100), fw=[(350, 2), (345, 2)], c52=(90, '10210.61'), box=(36, '3979.71'), total=3117),
    'BÈ 3': dict(page=3, scale=700, pv=3136, dpv=117, strings='112', inv=4, fs=(3224, 121), fw=[(472, 7), (162, 2)], c52=(186, '13355.70'), box=(19, '3558.71'), total=3858),
    'BÈ 4': dict(page=4, scale=600, pv=2252, dpv=89, strings='80.428571', inv=3, fs=(2280, 90), fw=[(261, 1), (729, 5), (261, 1)], c52=(77, '11690.48'), box=(36, '2962.08'), total=3531),
    'BÈ 5': dict(page=5, scale=350, pv=784, dpv=56, strings='28', inv=1, fs=(798, 57), fw=[(225, 1), (225, 1)], c52=(32, '3617.52'), box=(20, '784.10'), total=1248),
    'BÈ 6': dict(page=6, scale=500, pv=1568, dpv=56, strings='56', inv=2, fs=(1596, 57), fw=[(225, 1), (582, 2)], c52=(65, '7660.56'), box=(20, '1486.40'), total=2403),
    'BÈ 7': dict(page=7, scale=700, pv=2884, dpv=103, strings='103', inv=4, fs=(2968, 106), fw=[(266, 2), (298, 2)], c52=(176, '12283.55'), box=(14, '2851.12'), total=3532),
    'BÈ 8': dict(page=8, scale=600, pv=2884, dpv=110, strings='103', inv=4, fs=(2730, 102), fw=[(366, 2), (237, 2)], c52=(118, '11401.31'), box=(18, '2527.33'), total=3333),
}
CABLE_FLOATS = (707, 1414)  # tờ MB-B01-01, bảng "SỐ PHAO ĐỠ CÁP": 707 hàng, 1414 phao (cả hồ)
# frame direction on the sheet (from the table: mean bar length against the raft outline): True = C52 horizontal
C52_HORIZONTAL = {'BÈ 1': False, 'BÈ 2': True, 'BÈ 3': False, 'BÈ 4': True, 'BÈ 5': True, 'BÈ 6': True, 'BÈ 7': False, 'BÈ 8': False}

doc = pymupdf.open(PDF)
for name, s in SHEETS.items():
    text = doc[s['page'] - 1].get_text()
    must = [str(s['pv']), str(s['dpv']), s['strings'], str(s['fs'][0]), str(s['total']), str(s['c52'][0]), s['c52'][1], str(s['box'][0]), s['box'][1], f"1 : {s['scale']}"]
    must += [str(c) for c, _ in s['fw']]
    missing = [m for m in must if m not in text]
    assert not missing, f'{name}: {missing} không có trên tờ {s["page"]}'
    assert s['fs'][0] + sum(c for c, _ in s['fw']) == s['total'], name
assert '1414' in doc[8].get_text() and '707' in doc[8].get_text()

# ------------------------------------------------------------------ raft outline measured on the sheet image
def sheet_outline(page, scale, dpi=150):
    p = doc[page - 1]
    clip = pymupdf.Rect(28, 7, 1042, 835)  # drawing area, left of the title block
    pix = p.get_pixmap(dpi=dpi, clip=clip, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w)
    mpp = 25.4 / 72 * scale / 1000 / (dpi / 72)
    b = (a < 200).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, np.ones((int(1.5 / mpp),) * 2, np.uint8))  # fill the raft
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((int(6 / mpp),) * 2, np.uint8))    # drop tables, cable floats
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    m = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    cnt = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(cnt)
    return cv2.contourArea(cnt) * mpp * mpp, w * mpp, h * mpp

# ------------------------------------------------------------------ web layout (what the mooring is computed on)
data = ROOT / 'src' / 'data' / 'banMong'
polys = {r['name']: r for r in json.load(open(data / 'raftPolygons.json', encoding='utf-8'))}
catalogue = {r['name']: r for r in json.load(open(data / 'raftCatalogue.json', encoding='utf-8'))}
lines = json.load(open(data / 'coordinates.json', encoding='utf-8'))

def principal(points):
    """Dominant edge direction (mod 90°) of a rectilinear raft, and the extents along it and across it."""
    sx = sy = 0.0
    for i in range(len(points)):
        (x1, y1), (x2, y2) = points[i], points[(i + 1) % len(points)]
        L = math.hypot(x2 - x1, y2 - y1); a = 4 * math.atan2(y2 - y1, x2 - x1)
        sx += L * math.cos(a); sy += L * math.sin(a)
    th = math.atan2(sy, sx) / 4
    u = (math.cos(th), math.sin(th)); v = (-u[1], u[0])
    pu = [x * u[0] + y * u[1] for x, y in points]; pv = [x * v[0] + y * v[1] for x, y in points]
    return th, max(pu) - min(pu), max(pv) - min(pv)

layout = {}
for name in RAFTS:
    pts = [(p['x'], p['y']) for p in polys[name]['points']]
    th, Wu, Wv = principal(pts)
    s = SHEETS[name]
    area, w, h = sheet_outline(s['page'], s['scale'])
    sheet_h_is_u = abs(w - Wu) + abs(h - Wv) <= abs(w - Wv) + abs(h - Wu)
    # box 40x60 runs across the C52 beams; its world direction:
    box_along_sheet_h = not C52_HORIZONTAL[name]
    box_dir = th if box_along_sheet_h == sheet_h_is_u else th + math.pi / 2
    layout[name] = dict(pts=pts, th=th, Wu=Wu, Wv=Wv, area=area, w=w, h=h, box_dir=box_dir, sheet_h_is_u=sheet_h_is_u)

# ------------------------------------------------------------------ T per raft from the mooring BOQ (engine)
mw = openpyxl.load_workbook(MOORING_XLSX, data_only=True)['KiemTra_Nhanh']
T = {r[0]: r[1] for r in mw.iter_rows(min_row=4, values_only=True) if r[0] in RAFTS}
assert set(T) == set(RAFTS), T

# ------------------------------------------------------------------ anchor-point reinforcement clusters (Huổi Vanh method)
CLEAT_GAP, L_GC, B_C52 = 3.5, 15.0, 1.225

def nearest_edge(pts, x, y):
    best = None
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
        dx, dy = x2 - x1, y2 - y1; L2 = dx * dx + dy * dy
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L2))
        d = math.hypot(x1 + t * dx - x, y1 + t * dy - y)
        if best is None or d < best[0]:
            best = (d, i, t * math.sqrt(L2), math.atan2(dy, dx))
    return best

clusters = []
for name in RAFTS:
    lay = layout[name]
    along, across = {}, []
    for ln in [l for l in lines if l['raft'] == name]:
        d, edge, pos, ang = nearest_edge(lay['pts'], ln['xRaft'], ln['yRaft'])
        diff = abs((ang - lay['box_dir'] + math.pi / 2) % math.pi - math.pi / 2)
        for k, off in (('a', -CLEAT_GAP / 2), ('b', CLEAT_GAP / 2)):
            if diff < math.pi / 4:
                along.setdefault(edge, []).append((pos + off, ln['code'] + k))
            else:
                across.append(ln['code'] + k)
    for edge in sorted(along):
        group = []
        for pos, code in sorted(along[edge]):
            if group and pos - group[0][0] > L_GC - 1.0:
                clusters.append((name, 'Dọc cạnh (hộp song song mép bè, cách mép 1 hàng phao)', [c for _, c in group])); group = []
            group.append((pos, code))
        if group:
            clusters.append((name, 'Dọc cạnh (hộp song song mép bè, cách mép 1 hàng phao)', [c for _, c in group]))
    for code in across:
        clusters.append((name, 'Vuông góc cạnh (hộp chạy từ mép vào trong, cùng phương lực dây)', [code]))

# ------------------------------------------------------------------ workbook
wb = openpyxl.Workbook()
thin = Side(style='thin'); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HEAD = PatternFill('solid', fgColor='F2F2F2'); SEC = PatternFill('solid', fgColor='D9D9D9'); INPUT = PatternFill('solid', fgColor='FFFF99')
F = Font(name='Calibri', size=12); FB = Font(name='Calibri', size=12, bold=True)
WRAP = Alignment(wrap_text=True, vertical='center'); CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
RC = 'CDEFGHIJ'  # raft columns of DuLieuBanVe
TC = 'EFGHIJKL'  # raft columns of TongHop

def grid(ws, r0, r1, c1):
    for row in ws.iter_rows(min_row=r0, max_row=r1, max_col=c1):
        for c in row:
            c.border = BORDER
            if not c.font.b: c.font = F
            if c.alignment.horizontal is None: c.alignment = WRAP

# ---- GiaDinh
gd = wb.active; gd.title = 'GiaDinh'
GD = [
    ('L_C52', 'Chiều dài cây dầm C52 khi cấp hàng', 6, 'm', 'GIẢ ĐỊNH (như Huổi Vanh). HD lắp Mibet G5 dùng đoạn L2990 / L3750 — nếu cấp đoạn ~3 m thì số mối nối gần gấp đôi'),
    ('L_H', 'Chiều dài cây hộp 40x60', 6, 'm', 'GIẢ ĐỊNH, cây thép hộp thương mại 6 m'),
    ('M_C52', 'Khối lượng dầm C52', 2.36, 'kg/m', 'GIẢ ĐỊNH tiết diện C 52×41×12×2,0 (chưa có catalogue nhà sản xuất)'),
    ('M_H', 'Khối lượng hộp 40x60', 3.01, 'kg/m', 'GIẢ ĐỊNH 40×60×2,0'),
    ('K_FS', 'Gá trước (Front Support) mỗi tấm pin', 2, 'cái/tấm', 'ƯỚC LƯỢNG theo HD lắp G5'),
    ('K_BS', 'Gá sau (Back Support) mỗi tấm pin', 2, 'cái/tấm', 'ƯỚC LƯỢNG'),
    ('K_EC', 'Bộ kẹp biên tấm pin (End Clamp Kit) mỗi tấm', 2, 'bộ/tấm', 'ƯỚC LƯỢNG'),
    ('K_GC', 'Bộ kẹp tiếp địa mỗi tấm', 2, 'bộ/tấm', 'ƯỚC LƯỢNG; hỏi Mibet: kẹp biên/kẹp giữa có răng tiếp địa thì bỏ được hạng mục này, hoặc 1 bộ/tấm'),
    ('K_RN8', 'Bộ đai ốc thoi M8×25 bắt gá vào C52', 4, 'bộ/tấm', 'ƯỚC LƯỢNG = 1 bộ mỗi gá'),
    ('K_FB', 'Bộ bulông nhựa nối phao', 2, 'bộ/phao', 'ƯỚC LƯỢNG (HD: các phao nối với nhau bằng bulông + đai ốc nhựa)'),
    ('HH', 'Hao hụt phụ kiện, bulông', 3, '%', 'GIẢ ĐỊNH, chỉ cộng ở cột "Tổng có hao hụt"'),
    ('L_GC', 'Chiều dài 1 thanh hộp 40x60 gia cường tai neo', L_GC, 'm', 'Theo bản vẽ gia cường bè 1 Huổi Vanh (13,4–15,5 m)'),
    ('P_KEP', 'Sức chịu 1 móc "几" (2 đai ốc thoi M10×30 trong rãnh C52)', 7, 'kN', 'GIẢ ĐỊNH — chưa có số liệu nhà sản xuất; quyết định số thanh xếp song song ở cụm chịu lực lớn'),
    ('GAMMA', 'Hệ số tải trọng cho lực dây', 1.2, '', 'Như kiểm tra cọc (pileBendingLoadFactor)'),
    ('K_Y', 'Phần lực dây vào MỘT bích (cáp 2 nhánh chữ Y)', 0.7, '× T', 'Chia đều ở góc 60°: 0,58 T; lấy 0,7 T vì 2 nhánh có thể dài lệch nhau (cùng giả định với bảng neo)'),
    ('K_DU', 'Phần thừa trung bình của cây cuối mỗi thanh', 0.5, 'cây/thanh', 'ƯỚC LƯỢNG: không đo được từng thanh → số cây = ROUNDUP(tổng dài / L + số thanh × K_DU). Bè 5 (đo được): dầm 113,05 m cần 19 cây/thanh, công thức cho 19,3'),
    ('K_XF', 'Số chỗ dầm C52 vượt qua một hàng phao, trên 1 m dầm', 0.522, 'điểm/m', 'ĐO trên bè 5: mỗi dầm 113,05 m vượt 59 hàng phao (57 hàng đỡ pin + 2 hàng đi lại) → 0,522 điểm/m'),
    ('B_C52', 'Khoảng cách trung bình giữa các dầm C52 (theo phương hộp)', B_C52, 'm', 'ĐO trên bè 5: hộp 39,2 m giao 32 dầm → 1,225 m; 1 bulông M10×120 mỗi giao điểm hộp – dầm'),
]
gd['A1'] = 'THÔNG SỐ GIẢ ĐỊNH — ô tô vàng là ô NHẬP, sửa là cả file tự tính lại'; gd['A1'].font = Font(name='Calibri', size=13, bold=True)
for j, h in enumerate(['Mã', 'Thông số', 'Giá trị', 'Đơn vị', 'Ghi chú']):
    c = gd.cell(3, j + 1, h); c.font = FB; c.fill = HEAD; c.alignment = CENTER
G = {}
for i, (code, label, val, unit, note) in enumerate(GD):
    r = 4 + i; G[code] = f'GiaDinh!$C${r}'
    for j, v in enumerate([code, label, val, unit, note]):
        gd.cell(r, j + 1, v)
    gd.cell(r, 3).fill = INPUT
grid(gd, 3, 3 + len(GD), 5)
for col, w in zip('ABCDE', [9, 52, 10, 10, 110]): gd.column_dimensions[col].width = w

# ---- DuLieuBanVe
dl = wb.create_sheet('DuLieuBanVe', 0)
dl['A1'] = 'SỐ LIỆU LẤY TỪ BẢN VẼ "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG" (bảng thống kê trên từng tờ CT-BP-01…08)'; dl['A1'].font = Font(name='Calibri', size=13, bold=True)
for j, h in enumerate(['Mã', 'Hạng mục'] + RAFTS + ['TỔNG', 'Nguồn']):
    c = dl.cell(3, j + 1, h); c.font = FB; c.fill = HEAD; c.alignment = CENTER
fw = lambda name, k: SHEETS[name]['fw'][k][0] if k < len(SHEETS[name]['fw']) else 0
lineCount = {n: catalogue[n]['cableCount'] for n in RAFTS}
DL = [
    ('PV', 'Tấm pin (tấm)', lambda n: SHEETS[n]['pv'], 'Bảng "THỐNG KÊ TẤM PIN MẶT TRỜI", cột Số tấm pin'),
    ('DPV', 'Dải pin (hàng)', lambda n: SHEETS[n]['dpv'], 'Như trên, cột SỐ LƯỢNG HÀNG'),
    ('STR', 'Số string (bảng bản vẽ)', lambda n: float(SHEETS[n]['strings']), 'Như trên, cột So string — BÈ 4 ghi 80,43 (không nguyên)'),
    ('I510', 'Inverter SG-510HX (bộ)', lambda n: SHEETS[n]['inv'], 'Bảng "INVESTER"'),
    ('FS', 'Phao đỡ pin — Main Floater (cái)', lambda n: SHEETS[n]['fs'][0], 'Bảng "SỐ PHAO NỔI THEO BÈ", dòng "DẢI PHAO ĐỠ PIN"'),
    ('FSR', 'Số hàng phao đỡ pin', lambda n: SHEETS[n]['fs'][1], 'Như trên, cột SỐ LƯỢNG HÀNG'),
    ('FWA', 'Phao đi lại nhóm 1 (cái)', lambda n: fw(n, 0), 'Dòng "DẢI PHAO ĐI LẠI" thứ nhất của bảng phao'),
    ('FWB', 'Phao đi lại nhóm 2 (cái)', lambda n: fw(n, 1), 'Dòng "DẢI PHAO ĐI LẠI" thứ hai'),
    ('FWC', 'Phao đi lại nhóm 3 (cái)', lambda n: fw(n, 2), 'Dòng thứ ba — chỉ BÈ 4'),
    ('FWR', 'Số hàng phao đi lại', lambda n: sum(r for _, r in SHEETS[n]['fw']), 'Cộng cột SỐ LƯỢNG HÀNG các dòng phao đi lại'),
    ('FT', 'Tổng phao (cái)', None, 'Khớp "Grand total" của bảng phao từng tờ'),
    ('C52N', 'Dầm C52 — số thanh', lambda n: SHEETS[n]['c52'][0], 'Bảng "THỐNG KÊ KHUNG THÉP"'),
    ('C52L', 'Dầm C52 — chiều dài (m)', lambda n: float(SHEETS[n]['c52'][1]), 'Bảng "THỐNG KÊ KHUNG THÉP"'),
    ('HN', 'Hộp 40x60 kết cấu — số thanh', lambda n: SHEETS[n]['box'][0], 'Bảng "THỐNG KÊ KHUNG THÉP"'),
    ('HL', 'Hộp 40x60 kết cấu — chiều dài (m)', lambda n: float(SHEETS[n]['box'][1]), 'Bảng "THỐNG KÊ KHUNG THÉP"'),
    ('LINE', 'Số dây neo của bè (tuyến cáp)', lambda n: lineCount[n], 'Mặt bằng neo trên web (bảng neo Bản Mòng)'),
]
D = {}
for i, (code, label, fn, src) in enumerate(DL):
    r = 4 + i; D[code] = r
    dl.cell(r, 1, code); dl.cell(r, 2, label); dl.cell(r, 12, src)
    for j, n in enumerate(RAFTS):
        col = RC[j]
        dl[f'{col}{r}'] = f'={col}{D["FS"]}+{col}{D["FWA"]}+{col}{D["FWB"]}+{col}{D["FWC"]}' if code == 'FT' else fn(n)
        dl[f'{col}{r}'].number_format = '#,##0.00' if code in ('C52L', 'HL') else ('0.00' if code == 'STR' else '#,##0')
    dl[f'K{r}'] = f'=SUM(C{r}:J{r})'; dl[f'K{r}'].number_format = dl[f'C{r}'].number_format
r = 4 + len(DL); D['FC'] = r
dl.cell(r, 1, 'FC'); dl.cell(r, 2, 'Phao đỡ cáp điện giữa các bè (cái, cả hồ)'); dl[f'K{r}'] = CABLE_FLOATS[1]
dl.cell(r, 12, f'Tờ MB-B01-01, bảng "SỐ PHAO ĐỠ CÁP": {CABLE_FLOATS[0]} hàng, {CABLE_FLOATS[1]} phao (không chia theo bè)')
grid(dl, 3, r, 12)
for col, w in zip('ABCDEFGHIJKL', [8, 44, 11, 11, 11, 11, 11, 11, 11, 11, 12, 70]): dl.column_dimensions[col].width = w

# ---- GiaCuong_UocTinh
gc = wb.create_sheet('GiaCuong_UocTinh')
gc['A1'] = 'HỘP 40x60 GIA CƯỜNG TAI NEO — ƯỚC TÍNH CHO CẢ 8 BÈ (bản vẽ 22/10 chưa có), CÁP 2 NHÁNH CHỮ Y (2 bích mỗi dây, cách nhau 3,5 m)'
gc['A2'] = ('Cùng cách của Huổi Vanh: mỗi cụm tai neo một (hoặc vài) thanh hộp dài L_GC kẹp móc "几" vào mọi dầm C52 nó cắt qua. Số thanh = MAX(1; số bích × K_Y × T × γ / (số giao C52 × P_KEP)). '
            'Bích trên cạnh song song với hộp 40x60 → các bích trong đoạn L_GC − 1 m dùng chung 1 thanh dọc cạnh; bích trên cạnh vuông góc → mỗi bích 1 thanh từ mép vào trong. '
            'Vị trí dây theo mặt bằng neo của web; hướng hộp 40x60 của từng bè theo tờ bản vẽ 22/10.')
for a in ('A1', 'A2'): gc[a].font = FB if a == 'A1' else F
gc.merge_cells('A2:S2'); gc['A2'].alignment = WRAP; gc.row_dimensions[2].height = 48
HDR = ['Bè', 'Cụm', 'Cách bố trí', 'Bích trong cụm (mã dây + a/b)', 'Số bích', 'T dây (kN, gió 20 m/s)', 'Lực thiết kế cụm = số bích × K_Y × T × γ (kN)', 'Khoảng cách dầm C52 (m)', 'Dài 1 thanh (m)',
       'Giao C52 mỗi thanh', 'Sức chịu 1 thanh (kN)', 'Số thanh', 'Tổng dài (m)', 'Số cây cấp hàng', 'Số mối nối', 'Móc "几" (cái)', 'Đai ốc thoi M10×30 (bộ)', 'Bulông M10×120 (bộ)', 'Khối lượng (kg)']
for j, h in enumerate(HDR):
    c = gc.cell(3, j + 1, h); c.font = FB; c.fill = HEAD; c.alignment = CENTER
gc.row_dimensions[3].height = 62
k_per_raft = {}
for i, (name, kind, codes) in enumerate(clusters):
    r = 4 + i; k_per_raft[name] = k_per_raft.get(name, 0) + 1
    vals = [name, k_per_raft[name], kind, ', '.join(codes), len(codes), T[name],
            f'=E{r}*F{r}*{G["K_Y"]}*{G["GAMMA"]}', f'={G["B_C52"]}', f'={G["L_GC"]}', f'=ROUNDDOWN(I{r}/H{r},0)+1', f'=J{r}*{G["P_KEP"]}',
            f'=MAX(1,ROUNDUP(G{r}/K{r}-0.0005,0))', f'=L{r}*I{r}', f'=L{r}*ROUNDUP(I{r}/{G["L_H"]}-0.0005,0)', f'=L{r}*(ROUNDUP(I{r}/{G["L_H"]}-0.0005,0)-1)',
            f'=L{r}*J{r}', f'=2*P{r}', f'=P{r}', f'=M{r}*{G["M_H"]}']
    for j, v in enumerate(vals): gc.cell(r, j + 1, v)
    gc[f'G{r}'].number_format = '0.0'; gc[f'K{r}'].number_format = '0.0'; gc[f'M{r}'].number_format = '0.0'; gc[f'S{r}'].number_format = '#,##0.0'
GC_LAST = 3 + len(clusters)
grid(gc, 3, GC_LAST, 19)
for col, w in zip('ABCDEFGHIJKLMNOPQRS', [8, 6, 30, 34, 7, 10, 14, 10, 8, 9, 10, 8, 9, 9, 8, 9, 10, 10, 11]): gc.column_dimensions[col].width = w

# ---- DoiChieu_MatBang
dc = wb.create_sheet('DoiChieu_MatBang')
dc['A1'] = 'ĐỐI CHIẾU TỪNG TỜ CT-BP (22/10/2026) VỚI MẶT BẰNG BÈ MÀ WEB DÙNG TÍNH NEO (nhập từ tờ MB-B01-01)'; dc['A1'].font = Font(name='Calibri', size=13, bold=True)
dc['A2'] = ('Đường bao bè đo trên ảnh từng tờ CT-BP (tỷ lệ in trên tờ, gồm cả mép phao nên rộng hơn 1–2 m); mặt bằng trên web lấy đường bao bè của tờ MB-B01-01. '
            'Số tấm pin trên web lấy đúng bảng từng tờ — ĐÃ CHỐT 18.240 tấm (Pre-FS cũ ghi 16.892).')
dc.merge_cells('A2:N2'); dc['A2'].alignment = WRAP; dc.row_dimensions[2].height = 34
H2 = ['Bè', 'Tỷ lệ tờ', 'Diện tích bản vẽ 22/10 (m²)', 'Diện tích trên web (m²)', 'Lệch diện tích', 'Kích thước bản vẽ (m)', 'Kích thước trên web (m)', 'Tấm pin bản vẽ', 'Tấm pin trên web', 'Lệch tấm pin',
      'Dầm C52 TB 1 thanh (m)', 'Hộp 40x60 TB 1 thanh (m)', 'Phương dầm C52 trên tờ', 'Số dây neo']
for j, h in enumerate(H2):
    c = dc.cell(3, j + 1, h); c.font = FB; c.fill = HEAD; c.alignment = CENTER
dc.row_dimensions[3].height = 48
for i, n in enumerate(RAFTS):
    r = 4 + i; lay = layout[n]; s = SHEETS[n]
    dims_w = (lay['Wu'], lay['Wv']) if lay['sheet_h_is_u'] else (lay['Wv'], lay['Wu'])
    row = [n, f"1:{s['scale']}", round(lay['area']), polys[n]['area_m2'], f'=C{r}/D{r}-1', f"{lay['w']:.1f} × {lay['h']:.1f}".replace('.', ','), f"{dims_w[0]:.1f} × {dims_w[1]:.1f}".replace('.', ','),
           s['pv'], catalogue[n]['solarPanelCount'], f'=H{r}/I{r}-1', f"=DuLieuBanVe!{RC[i]}{D['C52L']}/DuLieuBanVe!{RC[i]}{D['C52N']}", f"=DuLieuBanVe!{RC[i]}{D['HL']}/DuLieuBanVe!{RC[i]}{D['HN']}",
           'ngang' if C52_HORIZONTAL[n] else 'đứng', lineCount[n]]
    for j, v in enumerate(row): dc.cell(r, j + 1, v)
    for col in 'EJ': dc[f'{col}{r}'].number_format = '+0.0%;-0.0%'
    for col in 'KL': dc[f'{col}{r}'].number_format = '0.0'
    for col in 'CDHI': dc[f'{col}{r}'].number_format = '#,##0'
r = 12
dc.cell(r, 1, 'TỔNG'); dc[f'C{r}'] = '=SUM(C4:C11)'; dc[f'D{r}'] = '=SUM(D4:D11)'; dc[f'E{r}'] = f'=C{r}/D{r}-1'; dc[f'H{r}'] = '=SUM(H4:H11)'; dc[f'I{r}'] = '=SUM(I4:I11)'; dc[f'J{r}'] = f'=H{r}/I{r}-1'; dc[f'N{r}'] = '=SUM(N4:N11)'
for col in 'EJ': dc[f'{col}{r}'].number_format = '+0.0%;-0.0%'
for col in 'CDHI': dc[f'{col}{r}'].number_format = '#,##0'
grid(dc, 3, 12, 14)
for c in dc[12]: c.font = FB
for col, w in zip('ABCDEFGHIJKLMN', [8, 8, 12, 12, 10, 16, 16, 10, 11, 9, 11, 11, 10, 9]): dc.column_dimensions[col].width = w

# ---- TongHop
th = wb.create_sheet('TongHop', 0)
th['A1'] = 'BẢNG TỔNG HỢP VẬT TƯ BÈ PIN — 8 BÈ HỒ BẢN MÒNG (bản vẽ "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG", HD lắp Mibet MRac G5)'
th['A2'] = ('Nguồn: BV = lấy đúng bảng thống kê trên bản vẽ; ĐO = đo trên bản vẽ bè 5 (tờ duy nhất vẽ được từng thanh); ƯL = ước lượng theo thông số sheet GiaDinh (phải đối chiếu BOM nhà sản xuất); '
            'NEO = theo mặt bằng neo trên web. Bản vẽ CHƯA có hộp 40x60 gia cường tai neo: mục D là ước tính.')
th.merge_cells('A1:P1'); th.merge_cells('A2:P2')
th['A1'].font = Font(name='Calibri', size=13, bold=True); th['A2'].alignment = WRAP; th.row_dimensions[1].height = 17; th.row_dimensions[2].height = 34
for j, h in enumerate(['STT', 'Hạng mục', 'Hình minh họa (tài liệu Mibet)', 'Đơn vị'] + RAFTS + ['TỔNG', 'Tổng có hao hụt', 'Nguồn', 'Ghi chú']):
    c = th.cell(3, j + 1, h); c.font = FB; c.fill = HEAD; c.alignment = CENTER
th.row_dimensions[3].height = 31

def dlref(code, j): return f'DuLieuBanVe!{RC[j]}{D[code]}'
def gcsum(col, n): return f'SUMIF(GiaCuong_UocTinh!$A$4:$A${GC_LAST},"{n}",GiaCuong_UocTinh!${col}$4:${col}${GC_LAST})'
ITEMS = [
    ('A. PIN, INVERTER, PHAO NỔI',),
    ('Tấm pin mặt trời', 'tấm', lambda j: '=' + dlref('PV', j), 'same', 'BV', 'ĐÃ CHỐT 18.240 tấm (Chủ đầu tư 22/10/2026), theo bảng từng tờ; Pre-FS cũ ghi 16.892 tấm'),
    ('Inverter SG-510HX', 'bộ', lambda j: '=' + dlref('I510', j), 'same', 'BV', '24 inverter; bản vẽ không có SG350HX'),
    ('Phao đỡ pin (Main Floater G5G)', 'cái', lambda j: '=' + dlref('FS', j), 'same', 'BV', ''),
    ('Phao đi lại (Walkway Floater) — nhóm 1', 'cái', lambda j: '=' + dlref('FWA', j), 'same', 'BV', 'Bản vẽ chia phao đi lại thành 2–3 dòng; cần nhà sản xuất xác nhận là 1 hay nhiều loại phao'),
    ('Phao đi lại (Walkway Floater) — nhóm 2', 'cái', lambda j: '=' + dlref('FWB', j), 'same', 'BV', ''),
    ('Phao đi lại (Walkway Floater) — nhóm 3', 'cái', lambda j: '=' + dlref('FWC', j), 'same', 'BV', 'Chỉ BÈ 4'),
    ('Tổng phao', 'cái', lambda j: '=' + dlref('FT', j), 'same', 'BV', ''),
    ('Phao đỡ cáp điện giữa các bè', 'cái', None, 'cable', 'BV', f'Tờ MB-B01-01: {CABLE_FLOATS[0]} hàng × 2 = {CABLE_FLOATS[1]} phao, cả hồ (không chia theo bè)'),
    ('Bộ bulông nhựa nối phao', 'bộ', lambda j: f'=ROUNDUP({dlref("FT", j)}*{G["K_FB"]},0)', 'hh', 'ƯL', 'Tổng phao bè × hệ số K_FB ở GiaDinh (chưa gồm phao đỡ cáp)'),
    ('B. DẦM C52 (đặt trên rãnh phao)',),
    ('Dầm C52 — số thanh liên tục (bảng bản vẽ)', 'thanh', lambda j: '=' + dlref('C52N', j), 'same', 'BV', ''),
    ('Dầm C52 — chiều dài', 'm', lambda j: '=' + dlref('C52L', j), 'same', 'BV', 'Bè 5 đo lại từng thanh: 32 × 113,05 m = 3.617,6 m (bảng 3.617,52 m)'),
    ('Dầm C52 — số cây cấp hàng', 'cây', lambda j: f'=ROUNDUP({dlref("C52L", j)}/{G["L_C52"]}+{dlref("C52N", j)}*{G["K_DU"]},0)', 'same', 'ƯL', 'Không đo được từng thanh: tổng dài / L_C52 + số thanh × K_DU (GiaDinh)'),
    ('Bộ nối dầm C52 (Splice for Beam-C)', 'bộ', lambda j: f'={TC[j]}{{r_prev}}-{TC[j]}{{r_bars}}', 'hh', 'ƯL', 'Số cây − số thanh. Nối đối đầu; mỗi bộ: 1 bản nối + 2 bulông M10×70 + 2 chốt M10×60 + đai ốc, long đen (tài liệu phụ kiện Mibet)'),
    ('Dầm C52 — khối lượng', 'kg', lambda j: f'={dlref("C52L", j)}*{G["M_C52"]}', 'same', 'ƯL', 'Theo tiết diện GIẢ ĐỊNH'),
    ('Bulông M8×35 bắt dầm C52 vào phao', 'bộ', lambda j: f'=ROUNDUP({dlref("C52L", j)}*{G["K_XF"]},0)', 'hh', 'ƯL', '1 bộ tại mỗi chỗ dầm C52 vượt qua một hàng phao; mật độ đo trên bè 5 (K_XF)'),
    ('C. HỘP 40x60 KẾT CẤU (nằm ngang trên dầm C52, cách nhau 6 m)',),
    ('Hộp 40x60 — số thanh liên tục', 'thanh', lambda j: '=' + dlref('HN', j), 'same', 'BV', ''),
    ('Hộp 40x60 — chiều dài', 'm', lambda j: '=' + dlref('HL', j), 'same', 'BV', 'Bè 5 đo lại: 20 × 39,2 m = 784,1 m (bảng 784,10 m)'),
    ('Hộp 40x60 — số cây cấp hàng', 'cây', lambda j: f'=ROUNDUP({dlref("HL", j)}/{G["L_H"]}+{dlref("HN", j)}*{G["K_DU"]},0)', 'same', 'ƯL', ''),
    ('Bộ nối hộp 40x60 (Splice for Square Steel)', 'bộ', lambda j: f'={TC[j]}{{r_prev}}-{TC[j]}{{r_bars}}', 'hh', 'ƯL', 'Nối đối đầu bằng bộ nối của nhà sản xuất (datasheet G5G); tài liệu Mibet không dùng nối chồng'),
    ('Hộp 40x60 — khối lượng', 'kg', lambda j: f'={dlref("HL", j)}*{G["M_H"]}', 'same', 'ƯL', 'Theo tiết diện GIẢ ĐỊNH'),
    ('Bulông M10×120 bắt hộp 40x60 vào dầm C52', 'bộ', lambda j: f'=ROUNDUP({dlref("HL", j)}/{G["B_C52"]},0)', 'hh', 'ƯL', '1 bộ tại mỗi giao điểm hộp – dầm C52 (HD lắp G5 bước 8); bè 5 đếm được 20 × 32 = 640'),
    ('D. HỘP 40x60 GIA CƯỜNG TAI NEO (bản vẽ CHƯA có — ƯỚC TÍNH cả 8 bè theo cách của Huổi Vanh)',),
    ('Hộp 40x60 gia cường — số thanh', 'thanh', lambda j: '=' + gcsum('L', RAFTS[j]), 'same', 'ƯL', 'Sheet GiaCuong_UocTinh (từng cụm tai neo)'),
    ('Hộp 40x60 gia cường — chiều dài', 'm', lambda j: '=' + gcsum('M', RAFTS[j]), 'same', 'ƯL', ''),
    ('Hộp 40x60 gia cường — số cây cấp hàng', 'cây', lambda j: '=' + gcsum('N', RAFTS[j]), 'same', 'ƯL', ''),
    ('Bộ nối hộp 40x60 (gia cường)', 'bộ', lambda j: '=' + gcsum('O', RAFTS[j]), 'hh', 'ƯL', ''),
    ('Móc chữ "几" kẹp hộp vào dầm C52', 'cái', lambda j: '=' + gcsum('P', RAFTS[j]), 'hh', 'ƯL', 'HD lắp G5 bước 8: hộp dùng làm điểm neo kẹp bằng móc "几" tại mọi giao điểm với C52'),
    ('Bộ đai ốc thoi M10×30 (cho móc "几")', 'bộ', lambda j: '=' + gcsum('Q', RAFTS[j]), 'hh', 'ƯL', '2 bộ mỗi móc'),
    ('Bulông M10×120 (hộp gia cường)', 'bộ', lambda j: '=' + gcsum('R', RAFTS[j]), 'hh', 'ƯL', '1 bộ mỗi móc'),
    ('Hộp 40x60 gia cường — khối lượng', 'kg', lambda j: '=' + gcsum('S', RAFTS[j]), 'same', 'ƯL', 'Theo tiết diện GIẢ ĐỊNH'),
    ('E. GÁ ĐỠ VÀ KẸP TẤM PIN',),
    ('Gá trước (Front Support G5)', 'cái', lambda j: f'={dlref("PV", j)}*{G["K_FS"]}', 'hh', 'ƯL', ''),
    ('Gá sau (Back Support G5)', 'cái', lambda j: f'={dlref("PV", j)}*{G["K_BS"]}', 'hh', 'ƯL', ''),
    ('Bộ kẹp biên tấm pin (End Clamp Kit, bulông M8×30)', 'bộ', lambda j: f'={dlref("PV", j)}*{G["K_EC"]}', 'hh', 'ƯL', ''),
    ('Bộ kẹp tiếp địa tấm pin', 'bộ', lambda j: f'={dlref("PV", j)}*{G["K_GC"]}', 'hh', 'ƯL', 'Cần nối đẳng thế khung tấm pin; hỏi Mibet kẹp của MRac G5 có răng tiếp địa không và định mức bộ/tấm trước khi đặt'),
    ('Bộ đai ốc thoi M8×25 + long đen lớn (gá vào C52)', 'bộ', lambda j: f'={dlref("PV", j)}*{G["K_RN8"]}', 'hh', 'ƯL', ''),
    ('F. ĐIỂM NEO TRÊN BÈ',),
    ('Ma ní chữ U (U-Shaped Shackle) làm bích neo trên bè', 'cái', lambda j: f'=2*{dlref("LINE", j)}', 'hh', 'NEO', 'Cáp 2 nhánh chữ Y: 2 bích mỗi dây, bắt vào hộp 40x60 gia cường; mắt nhánh cáp móc thẳng vào ma ní này. Số dây theo mặt bằng neo của web'),
]
row = 4; stt = 0; item_rows = {}
for it in ITEMS:
    if len(it) == 1:
        th.cell(row, 2, it[0]).font = FB
        for c in range(1, 17): th.cell(row, c).fill = SEC; th.cell(row, c).border = BORDER
        row += 1; continue
    name, unit, fn, total, src, note = it
    stt += 1; r = row; item_rows[name] = r
    th.cell(r, 1, stt); th.cell(r, 2, name); th.cell(r, 4, unit); th.cell(r, 15, src); th.cell(r, 16, note)
    if total == 'cable':
        th[f'M{r}'] = f'=DuLieuBanVe!K{D["FC"]}'
    else:
        for j in range(8):
            f = fn(j)
            if '{r_prev}' in f: f = f.replace('{r_prev}', str(r - 1)).replace('{r_bars}', str(r - 3))
            th[f'{TC[j]}{r}'] = f
        th[f'M{r}'] = f'=SUM(E{r}:L{r})'
    th[f'N{r}'] = f'=ROUNDUP(M{r}*(1+{G["HH"]}/100),0)' if total == 'hh' else f'=M{r}'
    for col in 'EFGHIJKLMN': th[f'{col}{r}'].number_format = '#,##0'
    row += 1
grid(th, 3, row - 1, 16)
for r in range(4, row):
    for col in 'AD': th[f'{col}{r}'].alignment = CENTER
for col, w in zip('ABCDEFGHIJKLMNOP', [6, 46, 23, 8, 11, 11, 11, 11, 11, 11, 11, 11, 12, 13, 8, 80]): th.column_dimensions[col].width = w
th.freeze_panes = 'E4'

# images from the Huổi Vanh workbook, by item name
tpl = openpyxl.load_workbook(TEMPLATE)['TongHop']
pics = {}
for im in tpl._images:
    name = tpl.cell(im.anchor._from.row + 1, 2).value
    a = im.anchor  # shown size = the template's two-cell anchor (the picture inside column C)
    w, h = ((a.to.colOff - a._from.colOff) / 9525, (a.to.rowOff - a._from.rowOff) / 9525) if hasattr(a, 'to') and a.to.col == a._from.col else (im.width, im.height)
    pics[name] = (im._data(), w, h)
for name, r in item_rows.items():
    src = pics.get(name) or pics.get(name.replace('— nhóm 3', '— nhóm 2'))
    if src:
        img = XLImage(io.BytesIO(src[0])); img.width, img.height = src[1], src[2]
        th.add_image(img, f'C{r}'); th.row_dimensions[r].height = 78
    else:
        th.cell(r, 3, '(không có hình trong tài liệu)').alignment = CENTER
        th.row_dimensions[r].height = 30

# ---- GhiChu
gh = wb.create_sheet('GhiChu')
gh['A1'] = 'GHI CHÚ, NGUỒN SỐ LIỆU VÀ CÁC ĐIỂM CẦN XÁC NHẬN'; gh['A1'].font = Font(name='Calibri', size=13, bold=True)
NOTES = [
    'Nguồn: "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG.pdf" (9 tờ: CT-BP-01…08 bố trí từng bè có bảng tấm pin, phao, khung thép, inverter; MB-B01-01 mặt bằng tổng có bảng phao đỡ cáp), HD lắp Mibet MRac G5, tài liệu phụ kiện Mibet, datasheet G5G. Script: scripts/buildBanMongRaftBOQ.py.',
    'Số tấm pin, phao, inverter, số thanh và chiều dài dầm C52, hộp 40x60 lấy NGUYÊN bảng thống kê trên bản vẽ (script kiểm tra từng số có trên đúng tờ).',
    'Bản vẽ 22/10 chỉ thể hiện các đoạn thép lộ giữa phao, nên KHÔNG đo được từng thanh như Huổi Vanh. Riêng tờ bè 5 vẽ thép bằng nét riêng: 32 dầm C52 dài 113,05 m và 20 hộp dài 39,2 m, khớp bảng (3.617,6 / 784,1 m). Số cây cấp hàng, mối nối, bulông M8 và M10 là ƯỚC LƯỢNG theo hệ số ở GiaDinh (K_DU, K_XF, B_C52 đo trên bè 5).',
    'Bản vẽ CHƯA có hộp 40x60 gia cường tai neo (Huổi Vanh mới có ở bè 1). Mục D ước tính cho cả 8 bè theo cách của Huổi Vanh: cáp 2 nhánh chữ Y (Chủ đầu tư chọn 16/10/2026 cho Huổi Vanh, áp dụng tạm cho Bản Mòng), 2 bích mỗi dây cách nhau 3,5 m, mỗi bích chịu K_Y × T; lực dây T của bè lấy từ bảng neo Bản Mòng (engine, gió 20 m/s, có thiết bị bù dao động mực nước). Lực dây Bản Mòng lớn hơn Huổi Vanh (62–130 kN so với 28–87 kN) nên mỗi cụm cần 1–5 thanh xếp song song (tổng nhiều hơn Huổi Vanh dù ít dây hơn) với P_KEP = 7 kN GIẢ ĐỊNH — cần số liệu sức chịu móc "几" của Mibet hoặc bản vẽ gia cường riêng.',
    'Mặt bằng neo (số dây, vị trí bích) là của web, tính trên mặt bằng bè 22/10/2026 (đường bao lấy từ tờ MB-B01-01, đặt về tọa độ PA2: so với PA2 chỉ BÈ 4 và BÈ 6 đổi hình). Đường bao đo trên từng tờ CT-BP rộng hơn 1–2 m vì gồm cả mép phao (sheet DoiChieu_MatBang).',
    'Số tấm pin ĐÃ CHỐT 18.240 tấm (Chủ đầu tư 22/10/2026; 13,5 MWp với tấm 740 Wp — Pre-FS cũ ghi 16.892 tấm, 12,5 MWp). Lực gió và lực dây trên web tính theo số tấm từng bè này. Còn để thiết kế điện xem: tờ BÈ 2 có 1 dải 28 tấm ghi chú "be 1"; BÈ 4 ghi 80,43 string (2.252 tấm không chia hết cho 28).',
    'Khối lượng thép theo tiết diện GIẢ ĐỊNH (C52 ≈ 2,36 kg/m; hộp 40×60×2,0 ≈ 3,01 kg/m) vì chưa có catalogue tiết diện của nhà sản xuất.',
    'Gá đỡ, kẹp tấm pin, bulông nối phao là ƯỚC LƯỢNG theo hệ số mỗi tấm / mỗi phao (sheet GiaDinh) — phải thay bằng BOM của nhà sản xuất khi có. Kẹp tiếp địa: hỏi Mibet trước khi đặt (có thể bỏ nếu kẹp có răng tiếp địa).',
    'Chưa gồm: cáp neo, phụ kiện đầu cáp, cọc khoan nhồi, đế neo, thiết bị bù dao động mực nước (xem bảng thống kê vật tư neo Bản Mòng), cáp điện DC/AC, máng cáp, tủ điện, tấm lối đi (Walkway Board) nếu có, vận chuyển.',
    'Hình minh họa ở cột C chép từ bảng Huổi Vanh (cắt từ tài liệu Mibet): chỉ để nhận dạng loại vật tư, không phải bản vẽ chế tạo.',
]
for i, t in enumerate(NOTES):
    gh.cell(3 + i, 1, i + 1); gh.cell(3 + i, 2, t).alignment = WRAP
grid(gh, 3, 2 + len(NOTES), 2)
gh.column_dimensions['A'].width = 5; gh.column_dimensions['B'].width = 150

wb._sheets = [wb['TongHop'], wb['DuLieuBanVe'], wb['GiaCuong_UocTinh'], wb['DoiChieu_MatBang'], wb['GiaDinh'], wb['GhiChu']]
wb.active = 0
wb.save(OUT)
add_apply_flags(OUT)
print(json.dumps({'out': OUT, 'clusters': len(clusters),
                  'byRaft': {n: sum(1 for c in clusters if c[0] == n) for n in RAFTS},
                  'outline': {n: [round(layout[n]['area']), polys[n]['area_m2']] for n in RAFTS}}, ensure_ascii=False))
