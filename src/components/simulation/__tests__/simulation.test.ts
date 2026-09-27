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
    expect(be12.area_m2).toBe(4018);

    const be5 = raftsV2.find((r: any) => r.name === 'BÈ 5');
    expect(be5).toBeDefined();
    expect(be5.area_m2).toBe(19405);

    // 298 Piles
    expect(pilesV2).toHaveLength(298);
    const shorePiles = pilesV2.filter((p: any) => p.type === 'SHORE');
    const bedPiles = pilesV2.filter((p: any) => p.type === 'BED');
    expect(shorePiles).toHaveLength(129);
    expect(bedPiles).toHaveLength(169);

    // 298 Mooring Lines
    expect(coordsV2).toHaveLength(298);

    // 3D Terrain Mesh
    expect(terrain.gridSize).toBe(64);
    expect(terrain.elevations).toHaveLength(64);
    expect(terrain.elevations[0]).toHaveLength(64);
  });
});
