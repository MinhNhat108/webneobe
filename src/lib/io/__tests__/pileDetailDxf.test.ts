import { describe, it, expect } from 'vitest';
import { buildPileDetailDxf, PILE_DETAIL_LAYERS } from '../pileDetailDxf';
import DxfParser from 'dxf-parser';

describe('CAD DXF Anchor Pile Structural Detail Generator', () => {
  it('generates a valid DXF R12 document with all structural sections', () => {
    const dxfString = buildPileDetailDxf({
      shorePileD_m: 0.45,
      shorePileL_m: 6.5,
      bedPileD_m: 0.35,
      bedPileL_m: 8.0,
      pReqShore_kN: 38.5,
      pMaxShore_kN: 65.0
    });

    expect(dxfString).toContain('$ACADVER');
    expect(dxfString).toContain('AC1009');
    expect(dxfString).toContain('SECTION\n2\nENTITIES');
    expect(dxfString).toContain('EOF');

    // Check all layers are defined
    for (const l of Object.values(PILE_DETAIL_LAYERS)) {
      expect(dxfString).toContain(l.name);
    }

    // Verify parser can parse it without error
    const parser = new DxfParser();
    const parsed = parser.parseSync(dxfString);
    expect(parsed).toBeDefined();
    expect(parsed?.entities?.length).toBeGreaterThan(50);
  });
});
