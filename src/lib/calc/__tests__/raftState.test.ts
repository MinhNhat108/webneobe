import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS, HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { buildRaftProjectState, raftDesignDeviations, resolveRaftState } from '../raftState';
import type { ProjectState } from '../types';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const anchor = () => dflt().anchor;

describe('resolveRaftState — one rule for every multi-raft view', () => {
  it('the bare default project is NOT BÈ 1 as designed (so it must never be shown as BÈ 1 unmapped)', () => {
    const labels = raftDesignDeviations(dflt(), HUOI_VANH_RAFTS[0], anchor()).map((d) => d.label);
    expect(labels).toContain('Số dây neo');
    expect(labels.length).toBeGreaterThan(3);
  });

  it('BÈ 1 mapped from the catalogue has no deviation', () => {
    const start = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], anchor());
    for (const item of HUOI_VANH_RAFTS) {
      const r = resolveRaftState(start, 1, item, anchor());
      expect(r.deviations, item.name).toEqual([]);
      expect(r.isActive, item.name).toBe(item.id === 1);
    }
  });

  it('the active raft IS the edited project; a project-wide edit is not a raft deviation', () => {
    const start = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[4], anchor());
    const edited: ProjectState = {
      ...start,
      env: { ...start.env, windSpeed_ms: 35 },
      anchor: { ...start.anchor, shoreL_m: start.anchor.shoreL_m + 1 }
    };
    const r = resolveRaftState(edited, 5, HUOI_VANH_RAFTS[4], anchor());
    expect(r.state).toBe(edited);
    expect(r.deviations).toEqual([
      { label: 'L_tk cọc bờ (m)', design: start.anchor.shoreL_m, current: start.anchor.shoreL_m + 1 }
    ]);
    // Another raft takes the wind edit but keeps its own design piles.
    const other = resolveRaftState(edited, 5, HUOI_VANH_RAFTS[0], anchor());
    expect(other.state.env.windSpeed_ms).toBe(35);
    expect(other.state.anchor.shoreL_m).toBe(HUOI_VANH_RAFTS[0].shorePileL_m);
  });
});
