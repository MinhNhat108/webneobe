"""
Lưới địa hình của Hồ Bản Mòng lấy từ BẢN ĐO ĐỊA HÌNH (DXF, VN-2000) thay cho lưới IFC 10 m:

  python scripts/surveyDxfToTerrain.py "Tài liệu hồ Bản Mòng/3.Ho Ban Mong.dxf" src/data/banMong/terrainMesh.json [bước lưới m = 5]

- Lấy đường đồng mức (lớp MAJOR_CONTOUR, MINOR_CONTOUR, cao độ ở elevation của polyline) và
  điểm cao độ (lớp Docao, chữ là cao độ).
- Đưa về hệ tọa độ của mặt bằng bè (khung IFC): tìm phép dịch + xoay nhỏ làm cao độ các điểm đo
  khớp lưới IFC hiện có nhất (bình phương nhỏ nhất). Script dừng nếu sai số trung vị > 2 m.
- Nội suy tuyến tính trên lưới tam giác (Delaunay) các điểm đo, bước lưới mặc định 5 m, cùng phạm vi
  với lưới IFC; ô cách điểm đo gần nhất hơn 25 m thì lấy giá trị IFC (nếu có), không thì để trống.
- Ghi đè file lưới cùng định dạng (rowOrder south-to-north, cao độ tuyệt đối, projectDatumOffset_m 0).
  Lần chạy sau vẫn khớp được vì lưới mới khớp chính bản đo; IFC gốc giữ ở trường `ifcFallback` để
  dùng lại cho ô trống.
"""
import json, math, sys
import numpy as np
import ezdxf
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import cKDTree

DXF, OUT = sys.argv[1], sys.argv[2]
STEP = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
MAX_GAP = 25.0

# ------------------------------------------------------------------ survey points (VN-2000)
doc = ezdxf.readfile(DXF)
msp = doc.modelspace()
pts = []
for e in msp.query('LWPOLYLINE[layer=="MAJOR_CONTOUR" | layer=="MINOR_CONTOUR"]'):
    el = e.dxf.elevation
    z = float(el[2] if hasattr(el, '__len__') else el)
    for p in e.get_points():
        pts.append((p[0], p[1], z))
n_contour = len(pts)
for e in msp.query('TEXT[layer=="Docao"]'):
    try:
        pts.append((e.dxf.insert[0], e.dxf.insert[1], float(e.dxf.text.replace(',', '.'))))
    except ValueError:
        pass
P = np.array(pts)
print(f'survey: {n_contour} contour vertices + {len(P) - n_contour} spot heights, z {P[:, 2].min():.1f}–{P[:, 2].max():.1f} m')

# ------------------------------------------------------------------ the grid it replaces (IFC frame)
old = json.load(open(OUT, encoding='utf-8'))
ifc = old.get('ifcFallback') or old
B = ifc['bounds']
IE = np.array([[np.nan if v is None else v for v in row] for row in ifc['elevations']], dtype=float) - (ifc.get('projectDatumOffset_m') or 0)
inx, iny = ifc['nx'], ifc['ny']
idx, idy = (B['maxX'] - B['minX']) / (inx - 1), (B['maxY'] - B['minY']) / (iny - 1)


def ifc_at(x, y):
    fx, fy = (x - B['minX']) / idx, (y - B['minY']) / idy
    ok = (fx >= 0) & (fy >= 0) & (fx <= inx - 1) & (fy <= iny - 1)
    c = np.clip(np.floor(fx).astype(int), 0, inx - 2); r = np.clip(np.floor(fy).astype(int), 0, iny - 2)
    tx, ty = fx - c, fy - r
    z00, z01, z10, z11 = IE[r, c], IE[r, c + 1], IE[r + 1, c], IE[r + 1, c + 1]
    z = (1 - tx) * (1 - ty) * z00 + tx * (1 - ty) * z01 + (1 - tx) * ty * z10 + tx * ty * z11
    return np.where(ok, z, np.nan)


def to_local(X, Y, dx, dy, rot):
    x0, y0 = X - dx, Y - dy
    return math.cos(rot) * x0 - math.sin(rot) * y0, math.sin(rot) * x0 + math.cos(rot) * y0


spots = P[n_contour:]
def rms(dx, dy, rot):
    x, y = to_local(spots[:, 0], spots[:, 1], dx, dy, rot)
    d = ifc_at(x, y) - spots[:, 2]
    d = d[~np.isnan(d)]
    return (np.sqrt(np.mean(d ** 2)) if len(d) > 0.4 * len(spots) else 1e9), d


best = (1e9, 0, 0, 0)
dx0, dy0 = P[:, 0].min() - B['minX'], P[:, 1].min() - B['minY']
for ddx in np.arange(-80, 81, 5):
    for ddy in np.arange(-80, 81, 5):
        r, _ = rms(dx0 + ddx, dy0 + ddy, 0.0)
        if r < best[0]: best = (r, dx0 + ddx, dy0 + ddy, 0.0)
for step, rstep in ((2, 0.002), (0.5, 0.0005), (0.1, 0.0001)):
    b0 = best
    for ddx in np.arange(-5, 5.01) * step:
        for ddy in np.arange(-5, 5.01) * step:
            for dr in np.arange(-4, 4.01) * rstep:
                r, _ = rms(b0[1] + ddx, b0[2] + ddy, b0[3] + dr)
                if r < best[0]: best = (r, b0[1] + ddx, b0[2] + ddy, b0[3] + dr)
_, d = rms(best[1], best[2], best[3])
med = float(np.median(np.abs(d)))
print(f'alignment: dX {best[1]:.2f} dY {best[2]:.2f} rot {math.degrees(best[3]):.3f}°, survey − IFC: median {med:.2f} m, p90 {np.percentile(np.abs(d), 90):.2f} m')
if med > 2.0:
    sys.exit('the survey does not match the raft frame (median > 2 m) — stopped')

# ------------------------------------------------------------------ interpolation on the IFC extent
lx, ly = to_local(P[:, 0], P[:, 1], best[1], best[2], best[3])
L = np.column_stack([lx, ly])
interp = LinearNDInterpolator(L, P[:, 2])
tree = cKDTree(L)
nx = int(round((B['maxX'] - B['minX']) / STEP)) + 1
ny = int(round((B['maxY'] - B['minY']) / STEP)) + 1
gx = np.linspace(B['minX'], B['maxX'], nx); gy = np.linspace(B['minY'], B['maxY'], ny)
GX, GY = np.meshgrid(gx, gy)  # rows south -> north
Z = interp(GX, GY)
dist, _ = tree.query(np.column_stack([GX.ravel(), GY.ravel()]))
far = dist.reshape(GX.shape) > MAX_GAP
Z[far] = np.nan
fill = ifc_at(GX, GY)
use_ifc = np.isnan(Z) & ~np.isnan(fill)
Z[use_ifc] = fill[use_ifc]
print(f'grid {nx} × {ny} at {STEP} m: survey {np.sum(~np.isnan(Z) & ~use_ifc)} cells, IFC fallback {np.sum(use_ifc)}, empty {np.sum(np.isnan(Z))}')

out = {
    'source': f'Bản đo địa hình {DXF.replace(chr(92), "/").split("/")[-1]} (VN-2000), đưa về khung mặt bằng bè; ô thiếu số liệu lấy từ IFC CHUGIAP.ifc',
    'generatedBy': 'scripts/surveyDxfToTerrain.py',
    'units': 'm',
    'frame': 'IFC local site frame (same X/Y as the raft outlines and mooring layout)',
    'rowOrder': 'south-to-north',
    'ifcWaterSurface_m': old.get('ifcWaterSurface_m'),
    'projectDatumOffset_m': 0,
    'survey': {'dX': round(best[1], 3), 'dY': round(best[2], 3), 'rot_deg': round(math.degrees(best[3]), 4), 'medianVsIfc_m': round(med, 2), 'step_m': STEP},
    'bounds': B, 'nx': nx, 'ny': ny,
    'elevations': [[None if np.isnan(v) else round(float(v), 2) for v in row] for row in Z],
    'ifcFallback': {k: ifc[k] for k in ('bounds', 'nx', 'ny', 'elevations', 'projectDatumOffset_m') if k in ifc},
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('written', OUT)
