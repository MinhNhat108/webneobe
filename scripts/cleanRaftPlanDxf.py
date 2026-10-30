"""cleanRaftPlanDxf.py — raft outlines of a client floor-plan DXF, as a small clean DXF.

    python scripts/cleanRaftPlanDxf.py "<client plan.dxf>" "<out.dxf>"

The Revit floor plans of the client (Bản Mòng "CHUGIAP-HOBANMONG ver 2 - Floor Plan - BỐ TRÍ BÈ PIN HỒ BẢN MÒNG.dxf",
2026-10-30) carry the raft outlines as LINE segments on layer A-DETL-THIN (mm) and the raft number as an MTEXT on
A-ANNO-NOTE, plus the survey contours and one Revit block per raft (~130 MB). The segments of a merged raft keep the
old raft borders inside it and some ends stop short of the next segment (a T-junction), so the importer's exact
end-to-end chaining cannot read them. This script:

1. snaps every segment end to the other segments within 0.05 m and polygonizes the result;
2. merges the faces that touch into one outline per raft (old borders inside a raft disappear);
3. names each outline by the label inside it, and stops if a raft has no label or two;
4. writes only those outlines (A-DETL-THIN, mm) and labels (A-ANNO-NOTE) — the input of
   `node scripts/importRaftLayoutBanMong.mjs <out.dxf>`.
"""
import sys

import ezdxf
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, snap, unary_union

SNAP_M = 0.05
MIN_FACE_M2 = 1.0


def main(src, out):
    msp = ezdxf.readfile(src).modelspace()
    segs = [LineString([(e.dxf.start.x / 1000, e.dxf.start.y / 1000), (e.dxf.end.x / 1000, e.dxf.end.y / 1000)])
            for e in msp.query('LINE[layer=="A-DETL-THIN"]')]
    union = unary_union(segs)
    segs = [snap(s, union, SNAP_M) for s in segs]
    faces = [f for f in polygonize(unary_union(segs)) if f.area > MIN_FACE_M2]
    labels = [(e.text.split(';')[-1].strip(), Point(e.dxf.insert.x / 1000, e.dxf.insert.y / 1000))
              for e in msp.query('MTEXT[layer=="A-ANNO-NOTE"]')]

    groups = []
    for f in faces:
        hit = [g for g in groups if any(f.buffer(SNAP_M).intersects(h) for h in g)]
        groups = [g for g in groups if g not in hit] + [[f] + [h for g in hit for h in g]]

    rafts = {}
    for g in groups:
        poly = unary_union([h.buffer(0.02, join_style=2) for h in g]).buffer(-0.02, join_style=2).simplify(0.02)
        if not isinstance(poly, Polygon):
            raise SystemExit(f'faces near {g[0].centroid} do not merge into one outline')
        inside = [t for t, p in labels if poly.contains(p)]
        if len(inside) != 1:
            raise SystemExit(f'outline at {poly.representative_point()} has labels {inside}')
        if inside[0] in rafts:
            raise SystemExit(f'two outlines labelled {inside[0]}')
        rafts[inside[0]] = poly

    doc = ezdxf.new('R2018')
    doc.units = 4
    doc.layers.add('A-DETL-THIN')
    doc.layers.add('A-ANNO-NOTE')
    m = doc.modelspace()
    for name in sorted(rafts, key=lambda s: (len(s), s)):
        poly = rafts[name]
        pts = list(poly.exterior.coords)[:-1]
        for i, a in enumerate(pts):
            b = pts[(i + 1) % len(pts)]
            m.add_line((a[0] * 1000, a[1] * 1000), (b[0] * 1000, b[1] * 1000), dxfattribs={'layer': 'A-DETL-THIN'})
        c = poly.representative_point()
        m.add_mtext(name, dxfattribs={'layer': 'A-ANNO-NOTE', 'insert': (c.x * 1000, c.y * 1000)})
        print(f'BÈ {name}: {poly.area:.0f} m2, P {poly.length:.1f} m, {len(pts)} pts')
    print(f'total {sum(p.area for p in rafts.values()):.0f} m2')
    doc.saveas(out)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
