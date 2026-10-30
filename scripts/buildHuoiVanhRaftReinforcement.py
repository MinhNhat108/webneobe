"""
Hộp 40x60 gia cường tại các vị trí neo, vẽ TRÊN bản vẽ khung kết cấu bè pin của Chủ đầu tư (Huổi Vanh, 4 bè):

  python scripts/buildHuoiVanhRaftReinforcement.py <thư mục kc1.dxf…kc4.dxf> <bảng vật tư neo .xlsx> <thư mục kết quả>
  python scripts/buildHuoiVanhRaftReinforcement.py <thư mục kc1.dxf…kc6.dxf> <bảng vật tư neo .xlsx> <thư mục kết quả> --lake=ban-mong

- Bản Mòng (6 bè): kc<i>.dxf = "CHUGIAP-HOBANMONG ver 2-Sheet - CT-KC-BE-0<i> - BỐ TRÍ KHUNG KẾT CẤU BÈ PIN 0<i>.dxf"
  (tờ Revit: khung là MỘT block ở model space tại 0,0, các dầm / hộp / phao là block lồng bên trong).

- kc<i>.dxf: "CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - KHUNG KẾT CẤU BÈ PIN <i>.dwg" đổi sang DXF (accoreconsole DXFOUT).
  Mỗi dầm C52, hộp 40x60, dải phao là một block Revit; script lấy khung bao của từng block (mm).
- Bản vẽ khung là mặt bằng neo xoay quanh gốc tọa độ (BÈ 1 ≈ 40°, BÈ 2 0°, BÈ 3 ≈ 344°, BÈ 4 90°): script tìm góc và
  độ dịch bằng cách khớp đường bao bè của web vào mép các dải phao (sai lệch trung bình in ra, phải < 1 m).
- Mỗi dây neo có 2 bích (cáp 2 nhánh chữ Y) cách nhau 3,5 m dọc mép bè. Thanh gia cường chạy theo phương hộp 40x60
  kết cấu (song song dải phao đỡ pin, vuông góc dầm C52), nằm trên một hàng phao, kẹp móc "几" vào MỌI dầm C52 nó
  cắt qua (đếm trên bản vẽ):
    + bích trên cạnh song song hộp: các bích trong 14 m dùng chung thanh dọc cạnh trên hàng phao thứ 2 tính từ mép;
    + bích trên cạnh vuông góc hộp: mỗi bích một thanh từ dầm C52 ngoài cùng chạy vào trong, trên hàng phao gần bích.
  Số thanh = MAX(1; ROUNDUP(số bích × K_Y × T × γ / (số dầm C52 thanh cắt qua × P_KEP))), thêm thanh trên hàng phao kế bên.
- Kết quả: gc_be<i>.dxf (chỉ phần gia cường, tọa độ của bản vẽ khung, mm — chèn vào DWG gốc tại 0,0), reinforcement.json
  (từng cụm, từng thanh, tọa độ mặt bằng neo; từng thanh C52 / hộp đo được) cho bảng vật tư bè pin và sơ đồ GC-01.
"""
import json, math, sys
from pathlib import Path

import cv2
import ezdxf
import numpy as np
import openpyxl
from ezdxf import bbox

ROOT = Path(__file__).resolve().parent.parent
BAN_MONG = '--lake=ban-mong' in sys.argv
KC_DIR, MOORING_XLSX, OUT_DIR = [Path(a) for a in sys.argv[1:] if not a.startswith('--')][:3]
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAFTS = [f'BÈ {i}' for i in range(1, 7 if BAN_MONG else 5)]

CLEAT_GAP, L_GC, P_KEP, K_Y, GAMMA = 3500.0, 15000.0, 7.0, 0.7, 1.2  # mm, mm, kN, -, -
CLUSTER_SPAN = L_GC - 1000.0

# ------------------------------------------------------------------ frame members of the owner's drawings
def members(i):
    """[kind, x0, y0, x1, y1] in mm of every C52, box 40x60 and float strip (cached next to the DXF)."""
    src = KC_DIR / f'kc{i}.dxf'
    cache = OUT_DIR / f'kc{i}.members.json'
    key = [src.stat().st_size, int(src.stat().st_mtime)]
    if cache.exists():
        c = json.load(open(cache, encoding='utf-8'))
        if c['key'] == key: return c['members']
    doc = ezdxf.readfile(src)
    out = []
    for top in doc.modelspace().query('INSERT'):
        tn = top.dxf.name.lower()
        for e in ([top] if ('dầm c52' in tn or 'phao' in tn or 'hộp' in tn) else top.virtual_entities()):
            if e.dxftype() != 'INSERT': continue
            n = e.dxf.name
            kind = 'C52' if ('Dầm C52-' in n and 'Hộp' not in n) else ('BOX' if 'Hộp 40x60' in n else ('FLOAT' if 'phao' in n.lower() else None))
            if not kind: continue
            b = bbox.extents([e])
            if b.has_data: out.append([kind, b.extmin.x, b.extmin.y, b.extmax.x, b.extmax.y])
    json.dump({'key': key, 'members': out}, open(cache, 'w', encoding='utf-8'))
    return out

# ------------------------------------------------------------------ web layout and line tension
data = ROOT / 'src' / 'data'
polys = {r['name']: r for r in json.load(open(data / ('banMong/raftPolygons.json' if BAN_MONG else 'huoiVanhRaftPolygons_v2.json'), encoding='utf-8'))}
lines = json.load(open(data / ('banMong/coordinates.json' if BAN_MONG else 'huoiVanhCoordinates_v2.json'), encoding='utf-8'))
# Ties between two rafts (lakeConfig raftTies, banMong/ties.json): ONE cleat at each end, carrying the whole tie design load
# of the catalogue (mooringLayout.group.tieDesign_kN), not the 0,7 T of a cleat of a Y-branched mooring line.
TIE_ENDS = []
if BAN_MONG and (data / 'banMong/ties.json').exists():
    cat = {r['name']: r for r in json.load(open(data / 'banMong/raftCatalogue.json', encoding='utf-8'))}
    for t in json.load(open(data / 'banMong/ties.json', encoding='utf-8')):
        for me, other in ((t['a'], t['b']), (t['b'], t['a'])):
            TIE_ENDS.append(dict(raft=me['raft'], code=t['code'], x=me['x'], y=me['y'], ox=other['x'], oy=other['y'],
                                 kN=cat[me['raft']]['mooringLayout']['group']['tieDesign_kN']))
mw = openpyxl.load_workbook(MOORING_XLSX, data_only=True)['KiemTra_Nhanh']
T = {r[0]: r[1] for r in mw.iter_rows(min_row=4, values_only=True) if r[0] in RAFTS}
assert set(T) == set(RAFTS), T

def rot(a):
    a = math.radians(a)
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])

def fit(name, M):
    """Rotation (deg) and shift (m) that put the web outline (m) on the float strips of the frame drawing (mm / 1000)."""
    F = [r for r in M if r[0] == 'FLOAT']
    x0 = min(r[1] for r in F) / 1000 - 5; y0 = min(r[2] for r in F) / 1000 - 5
    G = 0.1
    W = int((max(r[3] for r in F) / 1000 - x0 + 5) / G); H = int((max(r[4] for r in F) / 1000 - y0 + 5) / G)
    occ = np.zeros((H, W), np.uint8)
    for r in F:
        occ[int((r[2] / 1000 - y0) / G):int((r[4] / 1000 - y0) / G) + 1, int((r[1] / 1000 - x0) / G):int((r[3] / 1000 - x0) / G) + 1] = 1
    occ = cv2.morphologyEx(occ, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    edge = cv2.morphologyEx(occ, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    dt = cv2.distanceTransform((1 - edge).astype(np.uint8), cv2.DIST_L2, 5) * G
    pts = np.array([[p['x'], p['y']] for p in polys[name]['points']])
    S = np.array([p + (q - p) * t for p, q in zip(pts, np.roll(pts, -1, 0)) for t in np.linspace(0, 1, max(2, int(np.linalg.norm(q - p))))])
    def cost(a, tx, ty):
        q = S @ rot(a).T + [tx, ty]
        return float(dt[np.clip(((q[:, 1] - y0) / G).astype(int), 0, H - 1), np.clip(((q[:, 0] - x0) / G).astype(int), 0, W - 1)].mean())
    fw, fh = W * G - 10, H * G - 10
    best = None
    for a10 in range(0, 3600, 5):  # coarse: the outline's box must match the strips' box
        q = pts @ rot(a10 / 10).T
        if abs(np.ptp(q[:, 0]) - fw) > 8 or abs(np.ptp(q[:, 1]) - fh) > 8: continue
        t = np.array([x0 + 5 + fw / 2, y0 + 5 + fh / 2]) - (q.max(0) + q.min(0)) / 2
        c = cost(a10 / 10, *t)
        if best is None or c < best[0]: best = (c, a10 / 10, t[0], t[1])
    fixed = False
    if BAN_MONG:
        # Bản Mòng: the frame of the Revit sheet is axis-aligned, so the rotation turns the outline's main edges onto the
        # axes (BÈ 3: a 100 × 37,1 m rectangle at 86° in a 101 × 39 m frame; a free fit stops at 93° because the frame is
        # wider than the outline).
        E = [(np.linalg.norm(q - p), math.degrees(math.atan2(*(q - p)[::-1])) % 90) for p, q in zip(pts, np.roll(pts, -1, 0))]
        d = max(set(round(e[1], 1) for e in E), key=lambda a: sum(L for L, b in E if abs(b - a) < 0.2))
        snap = min((k * 90 - d for k in range(-1, 6)), key=lambda a: abs(a - best[1]))
        if abs(snap - best[1]) < 2.5:
            best = (cost(snap, best[2], best[3]), snap % 360, best[2], best[3]); fixed = True
    for sa, stt in ((0.2, 1.0), (0.05, 0.25), (0.01, 0.05)):
        improved = True
        while improved:
            improved = False
            c, a, tx, ty = best
            for da in ((0,) if fixed else (-sa, 0, sa)):
                for dx in (-stt, 0, stt):
                    for dy in (-stt, 0, stt):
                        v = cost(a + da, tx + dx, ty + dy)
                        if v < best[0] - 1e-9: best = (v, a + da, tx + dx, ty + dy); improved = True
    return best

# ------------------------------------------------------------------ per raft
result = {'rafts': {}}
for i, name in enumerate(RAFTS, start=1):
    M = members(i)
    meanDist, ang, tx, ty = fit(name, M)
    assert meanDist < 1.0, f'{name}: đường bao không khớp bản vẽ khung (lệch trung bình {meanDist:.2f} m)'
    Rm = rot(ang)
    to_frame = lambda x, y: tuple((Rm @ np.array([x, y]) + [tx, ty]) * 1000)
    to_world = lambda u, v: tuple(np.linalg.solve(Rm, np.array([u, v]) / 1000 - [tx, ty]))
    box_h = sum(1 for r in M if r[0] == 'BOX' and r[3] - r[1] > r[4] - r[2]) > sum(1 for r in M if r[0] == 'BOX') / 2
    # work in (u, v): u along the box 40x60 / float strips, v along the C52
    uv = (lambda x, y: (x, y)) if box_h else (lambda x, y: (y, x))
    xy = uv  # the swap is its own inverse
    C52 = []
    for r in M:
        if r[0] != 'C52': continue
        (u0, v0), (u1, v1) = uv(r[1], r[2]), uv(r[3], r[4])
        C52.append(((u0 + u1) / 2, min(v0, v1), max(v0, v1)))
    ROWS = []  # support float strips parallel to u: (v centre, u0, u1)
    for r in M:
        if r[0] != 'FLOAT': continue
        (u0, v0), (u1, v1) = uv(r[1], r[2]), uv(r[3], r[4])
        if abs(u1 - u0) > abs(v1 - v0): ROWS.append(((v0 + v1) / 2, min(u0, u1), max(u0, u1)))
    pts = [uv(*to_frame(p['x'], p['y'])) for p in polys[name]['points']]
    cu = sum(p[0] for p in pts) / len(pts); cv = sum(p[1] for p in pts) / len(pts)
    ccw = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1])) > 0

    def crossings(v, ua, ub):
        return sorted(c[0] for c in C52 if ua <= c[0] <= ub and c[1] - 1 <= v <= c[2] + 1)

    def row_extent(v):
        cs = [c[0] for c in C52 if c[1] - 1 <= v <= c[2] + 1]
        return (min(cs), max(cs)) if cs else None

    used = []  # (v, ua, ub) of bars already placed

    def free(v, ua, ub):
        return all(abs(v - w) > 10 or ub < a or ua > b for w, a, b in used)

    def nearest_edge(u, v):
        best = None
        for k in range(len(pts)):
            (x1, y1), (x2, y2) = pts[k], pts[(k + 1) % len(pts)]
            dx, dy = x2 - x1, y2 - y1; L2 = dx * dx + dy * dy
            t = max(0, min(1, ((u - x1) * dx + (v - y1) * dy) / L2))
            d = math.hypot(x1 + t * dx - u, y1 + t * dy - v)
            if best is None or d < best[0]: best = (d, k)
        return best[1]

    along, across = {}, []
    ends = [dict(code=ln['code'], xRaft=ln['xRaft'], yRaft=ln['yRaft'], xAnchor=ln['xAnchor'], yAnchor=ln['yAnchor'],
                 cleats=(('a', -CLEAT_GAP / 2, K_Y * T[name]), ('b', CLEAT_GAP / 2, K_Y * T[name]))) for ln in lines if ln['raft'] == name]
    ends += [dict(code=e['code'], xRaft=e['x'], yRaft=e['y'], xAnchor=e['ox'], yAnchor=e['oy'], cleats=(('', 0.0, e['kN']),))
             for e in TIE_ENDS if e['raft'] == name]
    for ln in ends:
        u, v = uv(*to_frame(ln['xRaft'], ln['yRaft']))
        k = nearest_edge(u, v)
        (x1, y1), (x2, y2) = pts[k], pts[(k + 1) % len(pts)]
        ex, ey = x2 - x1, y2 - y1; L = math.hypot(ex, ey); ex, ey = ex / L, ey / L
        nx, ny = (-ey, ex) if ccw else (ey, -ex)  # inward normal
        au, av = uv(*to_frame(ln['xAnchor'], ln['yAnchor']))
        for tag, off, load in ln['cleats']:
            p = (u + ex * off, v + ey * off, ln['code'] + tag, (au, av), load)
            if abs(ex) > abs(ey): along.setdefault(k, []).append(p)
            else: across.append((k, p, (nx, ny)))
    clusters = []

    def make(cid, kind, cl, bars_fn):
        need = sum(c[4] for c in cl) * GAMMA
        bars = bars_fn()
        if not bars: raise RuntimeError(f'{name} {cid}: không đặt được thanh ({[c[2] for c in cl]}, {[(round(c[0]), round(c[1])) for c in cl]})')
        n = max(1, math.ceil(need / (len(bars[0]['C52']) * P_KEP) - 0.0005))
        bars = bars_fn(n)
        clusters.append(dict(id=cid, kind=kind, cleats=[c[2] for c in cl], cleatUV=[(c[0], c[1]) for c in cl], anchorUV=[c[3] for c in cl],
                             cleatLoad_kN=[c[4] for c in cl], T_kN=T[name], design_kN=need, bars=bars, n=len(bars)))

    seq = 0
    for k in sorted(along):
        (x1, y1), (x2, y2) = pts[k], pts[(k + 1) % len(pts)]
        v_edge = (y1 + y2) / 2
        nx, ny = (-(y2 - y1), x2 - x1) if ccw else ((y2 - y1), -(x2 - x1))
        s = 1 if ny > 0 else -1  # inward along v
        group, groups = [], []
        for p in sorted(along[k]):
            if group and p[0] - group[0][0] > CLUSTER_SPAN:
                groups.append(group); group = []
            group.append(p)
        groups.append(group)
        for g in groups:
            seq += 1
            uc = (g[0][0] + g[-1][0]) / 2
            def bars_fn(n=1, g=g, uc=uc, v_edge=v_edge, s=s):
                # a row may be split by walkways: any strip of it overlapping the bar counts
                rows = sorted({round(r[0]): r for r in ROWS if (r[0] - v_edge) * s > 1500 and r[1] - 1 <= uc + L_GC / 2 and uc - L_GC / 2 <= r[2] + 1}.values(), key=lambda r: (r[0] - v_edge) * s)
                out = []
                for r in rows:
                    ext = row_extent(r[0])
                    if not ext: continue
                    ua, ub = uc - L_GC / 2, uc + L_GC / 2
                    if ext[1] - ext[0] >= L_GC:
                        sh = max(ext[0] - ua, 0) - max(ub - ext[1], 0); ua += sh; ub += sh
                    else:
                        ua, ub = ext
                    if not free(r[0], ua, ub):
                        # the neighbouring cluster's bar on this row: stop short of it if the bar still holds every cleat
                        lo, hi = g[0][0] - 1000, g[-1][0] + 1000
                        for w, a, bb in used:
                            if abs(r[0] - w) <= 10 and ub >= a and ua <= bb:
                                if bb <= lo: ua = max(ua, bb + 200)
                                elif a >= hi: ub = min(ub, a - 200)
                                else: ua, ub = 0, -1
                        if ub - ua < 10000 or not free(r[0], ua, ub): continue
                    out.append(dict(v=r[0], u0=ua, u1=ub, C52=crossings(r[0], ua, ub)))
                    if len(out) == n: break
                return out
            make(f'B{i}-{seq:02d}', 'Dọc cạnh', g, bars_fn)
            used.extend((b['v'], b['u0'], b['u1']) for b in clusters[-1]['bars'])
    for k, p, (nx, ny) in sorted(across, key=lambda q: (q[0], q[1][1])):
        seq += 1
        s = 1 if nx > 0 else -1  # inward along u
        def bars_fn(n=1, p=p, s=s):
            rows = sorted({round(r[0]): r for r in ROWS if r[1] - 3000 <= p[0] <= r[2] + 3000}.values(), key=lambda r: abs(r[0] - p[1]))
            out = []
            for r in rows:
                cs = sorted(c[0] for c in C52 if c[1] - 1 <= r[0] <= c[2] + 1 and (c[0] - p[0]) * s >= -1500)
                if not cs: continue
                start = cs[0] if s > 0 else cs[-1]
                ua, ub = sorted((start - s * 100, start + s * (L_GC - 100)))
                if not free(r[0], ua, ub):
                    # a bar of another cluster further in on this row: stop short of it (at least 6 m from the edge)
                    hit = [(a, bb) for w, a, bb in used if abs(r[0] - w) <= 10 and ub >= a and ua <= bb]
                    if s > 0: ub = min(a for a, _ in hit) - 200
                    else: ua = max(bb for _, bb in hit) + 200
                    if ub - ua < 6000 or not free(r[0], ua, ub): continue
                out.append(dict(v=r[0], u0=ua, u1=ub, C52=crossings(r[0], ua, ub)))
                if len(out) == n: break
            return out
        make(f'B{i}-{seq:02d}', 'Vuông góc cạnh', [p], bars_fn)
        used.extend((b['v'], b['u0'], b['u1']) for b in clusters[-1]['bars'])

    # ---------------------------------------------------------------- drawing (frame coordinates, mm)
    dxf = ezdxf.new('R2018', setup=True)
    dxf.header['$INSUNITS'] = 4
    dxf.styles.add('GC_VN', font='arial.ttf')
    for lname, color in (('GC-HOP 40x60 GIA CUONG', 1), ('GC-BICH NEO', 6), ('GC-DAY NEO', 5), ('GC-GHI CHU', 2)):
        dxf.layers.add(lname, color=color)
    msp = dxf.modelspace()
    TH = 700.0
    txt = lambda s, at, h=TH, layer='GC-GHI CHU', r=0: msp.add_text(s, height=h, rotation=r, dxfattribs={'layer': layer, 'style': 'GC_VN'}).set_placement(at)
    rot_txt = 0 if box_h else 90
    for c in clusters:
        for b in c['bars']:
            p0, p1 = xy(b['u0'], b['v']), xy(b['u1'], b['v'])
            msp.add_lwpolyline([p0, p1], dxfattribs={'layer': 'GC-HOP 40x60 GIA CUONG', 'const_width': 150})
            for u in b['C52']:
                msp.add_circle(xy(u, b['v']), 120, dxfattribs={'layer': 'GC-HOP 40x60 GIA CUONG'})  # "几" clamp at each C52
        for (u, v), (au, av) in zip(c['cleatUV'], c['anchorUV']):
            msp.add_circle(xy(u, v), 350, dxfattribs={'layer': 'GC-BICH NEO'})
            d = math.hypot(au - u, av - v)
            msp.add_line(xy(u, v), xy(u + (au - u) / d * 8000, v + (av - v) / d * 8000), dxfattribs={'layer': 'GC-DAY NEO'})
        b = c['bars'][-1]
        lu = (b['u0'] + b['u1']) / 2
        lv = b['v'] + (900 if all(b['v'] >= o['v'] for o in c['bars']) else -1600)
        txt(f"{c['id']}: {c['n']}×{(b['u1'] - b['u0']) / 1000:.1f} m".replace('.', ','), xy(lu - 3000, lv), TH, 'GC-GHI CHU', rot_txt)
    # schedule beside the raft
    fx = [r[1] for r in M] + [r[3] for r in M]; fy = [r[2] for r in M] + [r[4] for r in M]
    X0, Y0 = max(fx) + 15000, max(fy)
    nb = sum(c['n'] for c in clusters); Lt = sum((b['u1'] - b['u0']) / 1000 for c in clusters for b in c['bars']); nc = sum(len(b['C52']) for c in clusters for b in c['bars'])
    head = [f'HỘP 40x60 GIA CƯỜNG TẠI VỊ TRÍ NEO — {name} (cáp 2 nhánh chữ Y, T = {T[name]:.1f} kN'.replace('.', ',')
            + (f'; dây nối T..: 1 bích, {next(e["kN"] for e in TIE_ENDS if e["raft"] == name):.1f} kN)'.replace('.', ',') if any(e['raft'] == name for e in TIE_ENDS) else ')'),
            f'{len(clusters)} cụm, {nb} thanh, {Lt:,.1f} m hộp 40x60, {nc} móc "几" (đỏ: thanh gia cường; vòng nhỏ: móc kẹp vào dầm C52; tím: bích neo; xanh: phương dây neo)'.replace(',', '#').replace('.', ',').replace('#', '.'),
            'Số thanh = MAX(1; ROUNDUP(số bích × 0,7 T × 1,2 / (số dầm C52 thanh cắt qua × 7 kN))); bích dây nối hai bè lấy cả lực dây nối thay cho 0,7 T. Sức chịu 1 móc "几" 7 kN là GIẢ ĐỊNH — chờ số liệu Mibet.',
            'Thanh nằm trên hàng phao, theo phương hộp 40x60 kết cấu, kẹp móc "几" (2 đai ốc thoi M10×30 + 1 bulông M10×120) vào MỌI dầm C52 nó cắt qua.',
            'Chi tiết liên kết bích – hộp và vị trí chính xác do nhà cung cấp bè xác nhận. Lớp GC-*: chèn tại 0,0 vào bản vẽ khung gốc.',
            '', 'MÃ CỤM | BÍCH | SỐ THANH × DÀI | DẦM C52 CẮT QUA / THANH']
    y = Y0
    for t in head:
        txt(t, (X0, y), TH * (1.4 if y == Y0 else 1.0)); y -= TH * 2.2
    col, y_start = 0, y
    for c in clusters:
        if y < Y0 - 120 * TH * 2.2:
            col += 1; y = y_start
        txt(f"{c['id']} | {', '.join(c['cleats'])} | {c['n']} × {(c['bars'][0]['u1'] - c['bars'][0]['u0']) / 1000:.1f} m | {'/'.join(str(len(b['C52'])) for b in c['bars'])}".replace('.', ','), (X0 + col * 45000, y)); y -= TH * 1.8
    dxf.saveas(OUT_DIR / f'gc_be{i}.dxf')

    # ---------------------------------------------------------------- data for the bill of materials and GC-01
    for c in clusters:
        for b in c['bars']:
            b['world'] = [list(to_world(*xy(b['u0'], b['v']))), list(to_world(*xy(b['u1'], b['v'])))]
            b['L_m'] = (b['u1'] - b['u0']) / 1000
            b['nC52'] = len(b['C52'])
        c['cleatsWorld'] = [list(to_world(*xy(u, v))) for u, v in c['cleatUV']]
        for k in ('cleatUV', 'anchorUV'): c.pop(k)
        c['ties'] = [code for code in c['cleats'] if code.startswith('T')]
        for b in c['bars']: b.pop('C52')
    lens = lambda kind: sorted(round(max(r[3] - r[1], r[4] - r[2]) / 1000, 3) for r in M if r[0] == kind)
    result['rafts'][name] = dict(fit=dict(rot_deg=ang, shift_m=[tx, ty], meanDist_m=meanDist), boxAlongX=box_h, T_kN=T[name],
                                 c52_m=lens('C52'), box_m=lens('BOX'), floats=len([r for r in M if r[0] == 'FLOAT']),
                                 c52Pitch_m=float(np.mean(np.diff(sorted(set(round(c[0]) for c in C52))))) / 1000, clusters=clusters)
    print(name, f'fit {ang:.2f}° ({tx:.2f}, {ty:.2f}) lệch {meanDist:.2f} m', f'C52 {len(C52)} thanh', f'cụm {len(clusters)} thanh {nb} dài {Lt:.0f} m móc {nc}')

json.dump(result, open(OUT_DIR / 'reinforcement.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
