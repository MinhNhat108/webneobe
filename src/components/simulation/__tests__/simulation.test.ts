import { describe, it, expect } from 'vitest';
import { generateHuoiVanhSampleIfc } from '../sampleIfcGenerator';

describe('Huoi Vanh 3D Simulation & IFC Generation', () => {
  it('generates valid STEP-formatted IFC content with Huoi Vanh entities', () => {
    const ifcContent = generateHuoiVanhSampleIfc();

    expect(ifcContent).toContain('ISO-10303-21;');
    expect(ifcContent).toContain('FILE_SCHEMA((\'IFC2X3\'));');
    expect(ifcContent).toContain('IFCPROJECT');
    expect(ifcContent).toContain('DuAn_DMT_LongHo_HuoiVanh');
    expect(ifcContent).toContain('HoChua_HuoiVanh');
    expect(ifcContent).toContain('384.5'); // Water level datum
    expect(ifcContent).toContain('BE_1'); // Raft 1
    expect(ifcContent).toContain('IFCELEMENTASSEMBLY');
    expect(ifcContent).toContain('IFCPILE');
    expect(ifcContent).toContain('IFCMEMBER');
    expect(ifcContent).toContain('END-ISO-10303-21;');
  });

  it('contains appropriate 3D placement and owner history records', () => {
    const ifcContent = generateHuoiVanhSampleIfc();
    expect(ifcContent).toContain('IFCAXIS2PLACEMENT3D');
    expect(ifcContent).toContain('IFCLOCALPLACEMENT');
    expect(ifcContent).toContain('IFCSIUNIT');
  });

  it('validates V2 datasets extracted from dia hinh ho.ifc and HỒ HUỔI VANH.dxf', async () => {
    const raftsV2 = (await import('../../../data/huoiVanhRaftPolygons_v2.json')).default;
    const pilesV2 = (await import('../../../data/huoiVanhPiles_v2.json')).default;
    const coordsV2 = (await import('../../../data/huoiVanhCoordinates_v2.json')).default;
    const terrain = (await import('../../../data/huoiVanhTerrainMesh.json')).default;

    // 12 Raft clusters
    expect(raftsV2).toHaveLength(12);
    const totalArea = raftsV2.reduce((acc: number, r: any) => acc + r.area_m2, 0);
    expect(totalArea).toBeGreaterThan(90000);
    expect(totalArea).toBeLessThan(95000);

    const be12 = raftsV2.find((r: any) => r.name === 'BÈ 12');
    expect(be12).toBeDefined();
    expect(be12?.area_m2).toBe(4018);

    const be5 = raftsV2.find((r: any) => r.name === 'BÈ 5');
    expect(be5).toBeDefined();
    expect(be5?.area_m2).toBe(16436); // re-cut to 150 x 109.57 m (client DXF 2026-09-27 23:12)

    // 304 square RC piles, derived one-per-line from the mooring layout
    expect(pilesV2).toHaveLength(304);
    const shorePiles = pilesV2.filter((p: any) => p.type === 'SHORE');
    const bedPiles = pilesV2.filter((p: any) => p.type === 'BED');
    expect(shorePiles).toHaveLength(129);
    expect(bedPiles).toHaveLength(175);
    expect(pilesV2.every((p: any) => p.shape === 'square')).toBe(true);

    // 304 Mooring Lines
    expect(coordsV2).toHaveLength(304);

    // 3D terrain height-field, extracted by scripts/extractTerrainFromIfc.mjs
    expect(terrain.rowOrder).toBe('south-to-north');
    expect(terrain.ifcWaterSurface_m).toBe(402);
    expect(terrain.elevations).toHaveLength(terrain.ny);
    expect(terrain.elevations[0]).toHaveLength(terrain.nx);
  });

  it('the sample IFC carries the final 304 square piles, not the retired 298-line V1 layout', () => {
    const ifc = generateHuoiVanhSampleIfc();
    expect((ifc.match(/=IFCPILE\(/g) || []).length).toBe(304);
    expect((ifc.match(/=IFCMEMBER\(/g) || []).length).toBe(304);
    expect(ifc).toContain('square RC pile');
    expect(ifc).not.toMatch(/Pile D0\.\d+m/); // the old round-pile wording
    // every GlobalId is exactly 22 characters
    for (const m of ifc.matchAll(/=IFC(?:PILE|MEMBER|ELEMENTASSEMBLY)\('([^']*)'/g)) expect(m[1]).toHaveLength(22);
  });
});
