import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { calculateProject } from '../src/lib/calc/index';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import { buildMooringScrewBaseDxf } from '../src/lib/io/screwBaseDxf';
import { buildMooringPileDxf } from '../src/lib/io/dxfExport';
import { buildMooringDeadweightDxf } from '../src/lib/io/deadweightDxf';

const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
const state = buildRaftProjectState(base, HUOI_VANH_RAFTS[0], base.anchor);
const res = calculateProject(state);
const batch = HUOI_VANH_RAFTS.map(r => ({ raft: r, state: buildRaftProjectState(state, r, base.anchor), results: calculateProject(buildRaftProjectState(state, r, base.anchor)) }));

const d1 = buildMooringPileDxf(state, res, batch);
console.log('PA1 pile dxf: rafts =', d1.raftCount, 'piles =', d1.pileCount);

const d3 = buildMooringScrewBaseDxf(state, res, batch);
console.log('PA3 screw base dxf: rafts =', d3.raftCount, 'bases =', d3.baseCount, 'shores =', d3.shorePileCount);
