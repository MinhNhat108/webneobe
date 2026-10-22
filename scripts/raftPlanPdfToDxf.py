"""
Mặt bằng bè pin hồ Bản Mòng từ bản vẽ PDF → DXF cho importRaftLayoutBanMong.mjs.

  python scripts/raftPlanPdfToDxf.py "<221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG.pdf>" "<PA2 tham chiếu .dxf>" "<out.dxf>"

Bản vẽ 22/10/2026 chỉ có PDF (Revit in ra). Trên tờ mặt bằng tổng MB-B01-01
(1:3500) mỗi bè là một mảng tô xám cắt theo đường bao bè (clip path): lấy
đường bao đó, đổi pt → m theo tỷ lệ tờ, rồi đặt về tọa độ của mặt bằng PA2
(DXF 19/10) bằng phép đồng dạng khớp trọng tâm các bè KHÔNG đổi (diện tích
lệch < 0,5 %). Kiểm tra: tỷ lệ phải ≈ 1, góc xoay ≈ 0, sai lệch trọng tâm
< 0,2 m — sai thì dừng.

Đường bao in ra có răng cưa nhỏ: rút gọn Douglas–Peucker 0,3 m; đỉnh nào nằm
trong 0,3 m của một đỉnh PA2 thì lấy đúng đỉnh PA2 (bè không đổi giữ nguyên
hình PA2). Ghi LINE trên layer A-DETL-THIN (mm) và số bè (MTEXT, A-ANNO-NOTE)
như bản vẽ của Chủ đầu tư.
"""
import math, re, sys
import cv2
import numpy as np
import pymupdf

PDF, PA2_DXF, OUT = sys.argv[1:4]
SCALE = 3500
K = 25.4 / 72 * SCALE / 1000  # m per pt on MB-B01-01

# ------------------------------------------------------------------ PA2 outlines (same parsing as the importer)
def read_pa2(path):
    L = open(path, encoding='utf-8', errors='ignore').read().split('\n')
    i = next(k for k in range(0, len(L) - 1) if L[k].strip() == '2' and L[k + 1].strip() == 'ENTITIES')
    ents, cur = [], None
    for k in range(i + 2, len(L) - 1, 2):
        c, v = L[k].strip(), L[k + 1].strip()
        if c == '0':
            if v == 'ENDSEC': break
            if cur: ents.append(cur)
            cur = {'type': v, 'g': []}
        elif cur: cur['g'].append((c, v))
    if cur: ents.append(cur)
    get = lambda e, c: next((v for k, v in e['g'] if k == c), None)
    segs = [((float(get(e, '10')) / 1000, float(get(e, '20')) / 1000), (float(get(e, '11')) / 1000, float(get(e, '21')) / 1000))
            for e in ents if e['type'] == 'LINE' and get(e, '8') == 'A-DETL-THIN']
    labels = [(re.sub(r'^.*;', '', get(e, '1')).strip(), float(get(e, '10')) / 1000, float(get(e, '20')) / 1000)
              for e in ents if e['type'] == 'MTEXT' and get(e, '8') == 'A-ANNO-NOTE']
    key = lambda p: (round(p[0], 2), round(p[1], 2))
    adj = {}
    for n, s in enumerate(segs):
        for p in s: adj.setdefault(key(p), []).append(n)
    used, loops = set(), []
    for n in range(len(segs)):
        if n in used: continue
        pts, p = [segs[n][0]], segs[n][1]; used.add(n)
        while key(p) != key(pts[0]):
            pts.append(p)
            nxt = next((j for j in adj.get(key(p), []) if j not in used), None)
            if nxt is None: break
            used.add(nxt); p = segs[nxt][1] if key(segs[nxt][0]) == key(p) else segs[nxt][0]
        if key(p) == key(pts[0]) and len(pts) >= 3 and abs(area(pts)) > 500: loops.append(pts)
    out = {}
    for ring in loops:
        lab = next(t for t, x, y in labels if inside((x, y), ring))
        out[lab] = ring
    return out

def area(P): return sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P))) / 2
def centroid(P):
    A = area(P); cx = cy = 0
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % len(P)]; f = x1 * y2 - x2 * y1; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    return np.array([cx / (6 * A), cy / (6 * A)])
def inside(p, R):
    c = False
    for i in range(len(R)):
        a, b = R[i], R[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c

# ------------------------------------------------------------------ outlines on MB-B01-01
doc = pymupdf.open(PDF)
page = next(p for p in doc if 'MB-B01-01' in p.get_text())
D = page.get_drawings(extended=True)
raw = []
for i, dr in enumerate(D):
    if dr['type'] == 'f' and dr.get('fill') and all(abs(c - 0.502) < 0.01 for c in dr['fill']):
        clip = D[i - 1]
        assert clip['type'] == 'clip', 'raft fill without its outline clip'
        loops, cur = [], []
        for it in clip['items']:
            if it[0] != 'l': continue
            a, b = it[1], it[2]
            if cur and abs(cur[-1][0] - a.x) + abs(cur[-1][1] - a.y) > 1e-3: loops.append(cur); cur = []
            if not cur: cur = [(a.x, a.y)]
            cur.append((b.x, b.y))
        loops.append(cur)
        ring = max(loops, key=lambda L: abs(area(L)))
        raw.append([(x * K, -y * K) for x, y in ring])  # m, y up
assert len(raw) == 8, f'{len(raw)} raft outlines on MB-B01-01'
pa2 = read_pa2(PA2_DXF)

# ------------------------------------------------------------------ register to the PA2 coordinates
names = sorted(pa2, key=int)
c_pdf = [centroid(r) for r in raw]
c_pa2 = {n: centroid(pa2[n]) for n in names}
m_pdf, m_pa2 = np.mean(c_pdf, 0), np.mean(list(c_pa2.values()), 0)
match = {i: min(names, key=lambda n: np.linalg.norm((c - m_pdf) - (c_pa2[n] - m_pa2))) for i, c in enumerate(c_pdf)}
assert sorted(match.values(), key=int) == names, match
same = [i for i in match if abs(abs(area(raw[i])) / abs(area(pa2[match[i]])) - 1) < 0.005]
assert len(same) >= 3, 'too few unchanged rafts to place the plan'
A = np.array([c_pdf[i] for i in same]); B = np.array([c_pa2[match[i]] for i in same])
ma, mb = A.mean(0), B.mean(0)
U, S, Vt = np.linalg.svd((A - ma).T @ (B - mb)); R = Vt.T @ U.T
s = S.sum() / ((A - ma) ** 2).sum(); t = mb - s * R @ ma
res = [float(np.linalg.norm(s * R @ c_pdf[i] + t - c_pa2[match[i]])) for i in same]
rot = math.degrees(math.atan2(R[1, 0], R[0, 0]))
print(f'đặt mặt bằng: tỷ lệ {s:.5f}, xoay {rot:.4f}°, sai lệch trọng tâm bè không đổi tới {max(res):.3f} m ({", ".join("BÈ " + match[i] for i in same)})')
assert abs(s - 1) < 2e-3 and abs(rot) < 0.1 and max(res) < 0.2, 'MB-B01-01 không khớp tọa độ PA2'

# ------------------------------------------------------------------ simplify, snap to PA2 corners
rafts = {}
for i, ring in enumerate(raw):
    P = np.array([s * R @ np.array(p) + t for p in ring])
    o = P.min(0)
    approx = cv2.approxPolyDP(((P - o) * 1000).astype(np.int64).reshape(-1, 1, 2).astype(np.int32), 300, True)[:, 0, :] / 1000 + o
    ref = np.array(pa2[match[i]])
    pts = []
    for q in approx:
        d = np.linalg.norm(ref - q, axis=1)
        pts.append(tuple(ref[d.argmin()]) if d.min() < 0.3 else (round(q[0], 3), round(q[1], 3)))
    # a corner printed as a tiny chamfer (edge < 1 m): back to the meeting point of its two neighbouring edges
    def meet(p1, p2, p3, p4):
        d1, d2 = np.subtract(p2, p1), np.subtract(p4, p3)
        den = d1[0] * d2[1] - d1[1] * d2[0]
        u = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / den
        return (p1[0] + u * d1[0], p1[1] + u * d1[1])
    while len(pts) > 4:
        k = next((k for k in range(len(pts)) if math.dist(pts[k], pts[(k + 1) % len(pts)]) < 1.0), None)
        if k is None: break
        n = len(pts)
        q = meet(pts[k - 1], pts[k], pts[(k + 1) % n], pts[(k + 2) % n])
        d = np.linalg.norm(ref - q, axis=1)
        q = tuple(ref[d.argmin()]) if d.min() < 0.3 else (round(q[0], 3), round(q[1], 3))
        pts = [q if j == k else pts[j] for j in range(n) if j != (k + 1) % n]
    if area(pts) < 0: pts = pts[::-1]
    rafts[match[i]] = pts
    kept = sum(1 for p in pts if any(np.allclose(p, r) for r in ref))
    print(f'BÈ {match[i]}: {abs(area(pts)):.0f} m² (PA2 {abs(area(pa2[match[i]])):.0f}), {len(pts)} đỉnh, {kept} đỉnh trùng PA2')

# ------------------------------------------------------------------ DXF (only what the importer reads)
out = ['0', 'SECTION', '2', 'ENTITIES']
for n in names:
    pts = rafts[n]
    for k in range(len(pts)):
        (x1, y1), (x2, y2) = pts[k], pts[(k + 1) % len(pts)]
        out += ['0', 'LINE', '8', 'A-DETL-THIN', '10', f'{x1 * 1000:.1f}', '20', f'{y1 * 1000:.1f}', '30', '0', '11', f'{x2 * 1000:.1f}', '21', f'{y2 * 1000:.1f}', '31', '0']
    c = centroid(pts)
    if not inside(c, pts):  # L-shaped raft: a point just inside its longest edge
        k = max(range(len(pts)), key=lambda k: math.dist(pts[k], pts[(k + 1) % len(pts)]))
        (x1, y1), (x2, y2) = pts[k], pts[(k + 1) % len(pts)]
        L = math.dist((x1, y1), (x2, y2)); c = np.array([(x1 + x2) / 2 - (y2 - y1) / L * 5, (y1 + y2) / 2 + (x2 - x1) / L * 5])
    out += ['0', 'MTEXT', '8', 'A-ANNO-NOTE', '10', f'{c[0] * 1000:.1f}', '20', f'{c[1] * 1000:.1f}', '30', '0', '40', '5000', '1', n]
out += ['0', 'ENDSEC', '0', 'EOF']
open(OUT, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('ghi', OUT)
