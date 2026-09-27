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
});
