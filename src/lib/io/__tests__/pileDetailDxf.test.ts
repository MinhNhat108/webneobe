import { describe, it, expect } from 'vitest';
import { buildPileDetailDxf, PILE_DETAIL_LAYERS, pileDetailOptionsFromProject, pileDetailFileName } from '../pileDetailDxf';
import { calculateProject } from '../../calc';
import { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
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

describe('Pile detail sheet is driven by the project, not by defaults', () => {
  it('quotes this project\'s own pile geometry and P_req / P_max', () => {
    const state = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
    const results = calculateProject(state);
    const opts = pileDetailOptionsFromProject(state, results);

    expect(opts.shorePileD_m).toBe(state.anchor.shoreD_m);
    expect(opts.shorePileL_m).toBe(state.anchor.shoreL_m);
    expect(opts.pReqShore_kN).toBe(results.shorePileOpt?.Preq_kN);
    expect(opts.pMaxShore_kN).toBe(results.shorePileOpt?.effectivePmax_kN);
    expect(opts.pReqBed_kN).toBe(results.bedPileOpt?.Preq_kN);

    // The generated sheet must carry the computed capacity, not the 65.0 kN
    // placeholder the generator falls back to when it is called bare.
    const dxf = buildPileDetailDxf(opts);
    expect(results.shorePileOpt?.effectivePmax_kN).not.toBe(65.0);
    expect(dxf).toContain((results.shorePileOpt!.effectivePmax_kN).toFixed(1));
    expect(dxf).toContain((results.shorePileOpt!.Preq_kN).toFixed(1));

    // And it must still be a parseable R12 document.
    const parsed: any = new DxfParser().parseSync(dxf);
    expect(parsed.entities.length).toBeGreaterThan(50);
  });

  it('names the file after the project and the date', () => {
    const state = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
    state.meta.code = 'HV-FPV-2026';
    expect(pileDetailFileName(state, new Date(2026, 8, 22))).toBe('cau-tao-coc-neo_HV-FPV-2026_20260922.dxf');
  });
});

describe('Capacity verdict on the sheet follows the numbers', () => {
  it('stamps DAT only when P_req <= P_max', () => {
    const ok = buildPileDetailDxf({ pReqShore_kN: 40, pMaxShore_kN: 80 });
    expect(ok).toContain('P_req = 40.0 kN | P_max = 80.0 kN (DAT)');

    // An overloaded pile must NOT be certified as passing on the drawing.
    const bad = buildPileDetailDxf({ pReqShore_kN: 120, pMaxShore_kN: 80 });
    expect(bad).toContain('KHONG DAT');
    expect(bad).not.toContain('P_req = 120.0 kN | P_max = 80.0 kN (DAT)');
  });
});
