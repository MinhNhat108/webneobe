import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
base.env.windSpeed_ms = 20.0;

console.log('Testing 9 rafts with wind = 20 m/s:');
for (const r of HUOI_VANH_RAFTS) {
  const st = buildRaftProjectState(base, r, base.anchor);
  st.env.windSpeed_ms = 20.0;
  const p3 = calculateProject({ ...st, anchor: { ...st.anchor, bedAnchorOption: 'PA3_SCREW_BASE' } });
  const sb = p3.bedScrewBase!;
  console.log(
    r.name.padEnd(6),
    `F_env: ${Math.round(p3.f_env_total_kN)} kN`,
    `T_max: ${p3.t_max_intact_kN.toFixed(1)} kN`,
    `cable: ${st.line.cableCode}`,
    `util: ${p3.cableUtilization?.toFixed(2)}`,
    `Base: ${sb.side_m}x${sb.side_m}x${sb.thickness_m}`,
    `mass: ${sb.liftMass_t.toFixed(1)} t`,
    `ok: ${sb.ok}`
  );
}
