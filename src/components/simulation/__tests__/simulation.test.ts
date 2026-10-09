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

    // 9 raft clusters (plan of 2026-10-08)
    expect(raftsV2).toHaveLength(9);
    const totalArea = raftsV2.reduce((acc: number, r: any) => acc + r.area_m2, 0);
    expect(totalArea).toBe(95873);

    const be9 = raftsV2.find((r: any) => r.name === 'BÈ 9');
    expect(be9?.area_m2).toBe(4018); // the old BÈ 12, unchanged

    const be5a = raftsV2.find((r: any) => r.name === 'BÈ 5A');
    expect(be5a?.area_m2).toBe(23037); // old 6 + 7 merged: the largest raft

    // 263 anchor points for 295 lines: all 32 lake-bed bases are shared by two lines
    expect(pilesV2).toHaveLength(263);
    const shorePiles = pilesV2.filter((p: any) => p.type === 'SHORE');
    const bedPiles = pilesV2.filter((p: any) => p.type === 'BED');
    expect(shorePiles).toHaveLength(231);
    expect(bedPiles).toHaveLength(32);
    expect(shorePiles.every((p: any) => p.shape === 'circular')).toBe(true);

    // 295 mooring lines
    expect(coordsV2).toHaveLength(295);

    // 3D terrain height-field, extracted by scripts/extractTerrainFromIfc.mjs
    expect(terrain.rowOrder).toBe('south-to-north');
    expect(terrain.ifcWaterSurface_m).toBe(402);
    expect(terrain.elevations).toHaveLength(terrain.ny);
    expect(terrain.elevations[0]).toHaveLength(terrain.nx);
  });

  it('the sample IFC carries the 263 anchor points and the 295 lines of the 9-raft layout', () => {
    const ifc = generateHuoiVanhSampleIfc();
    expect((ifc.match(/=IFCPILE\(/g) || []).length).toBe(263);
    expect((ifc.match(/=IFCMEMBER\(/g) || []).length).toBe(295);
    expect((ifc.match(/Shore bored pile D350mm/g) || []).length).toBe(231);
    expect((ifc.match(/Lake-bed anchor point/g) || []).length).toBe(32);
    expect((ifc.match(/, shared by lines /g) || []).length).toBe(32);
    expect(ifc).not.toMatch(/Pile D0\.\d+m/); // the old round-pile wording
    // every GlobalId is exactly 22 characters
    for (const m of ifc.matchAll(/=IFC(?:PILE|MEMBER|ELEMENTASSEMBLY)\('([^']*)'/g)) expect(m[1]).toHaveLength(22);
  });
});
