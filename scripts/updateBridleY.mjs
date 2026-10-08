import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dxfPath = path.join(here, '../docs/be1-ong-40x60/be1_ong_40x60.dxf');
const jsonPath = path.join(here, '../docs/be1-ong-40x60/be1_ong_40x60.json');

const raw = fs.readFileSync(dxfPath, 'utf8').split(/\r?\n/);
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Parse entities
let section = '';
let inEntities = false;
const beforeEntities = [];
const entities = [];
const afterEntities = [];

let curEntity = null;

for (let i = 0; i + 1 < raw.length; i += 2) {
  const code = raw[i].trim();
  const val = raw[i + 1].trim();

  if (code === '0' && val === 'SECTION') {
    section = raw[i + 3].trim();
  }

  if (section === 'ENTITIES') {
    if (code === '0' && val === 'ENDSEC') {
      if (curEntity) entities.push(curEntity);
      curEntity = null;
      section = '';
      afterEntities.push([code, val]);
      continue;
    }
    if (code === '0' && val === 'SECTION') {
      // beginning of ENTITIES section
      continue;
    }
    if (code === '2' && val === 'ENTITIES') {
      continue;
    }

    if (code === '0') {
      if (curEntity) entities.push(curEntity);
      curEntity = { type: val, props: [] };
    } else {
      if (curEntity) curEntity.props.push([code, val]);
    }
  } else if (entities.length === 0 && section !== 'ENTITIES') {
    beforeEntities.push([code, val]);
  } else {
    afterEntities.push([code, val]);
  }
}

console.log(`Parsed ${entities.length} entities from DXF.`);

// Group cleat lines on layer 11_DIEM_NEO_CAP
// Cleat circles/texts vs bridle lines
const cleatEntities = [];
const otherEntities = [];
const bridleLinesByCleat = new Map(); // key = "cx,cy" -> array of targets [tx, ty]

for (const ent of entities) {
  const layerProp = ent.props.find(([c]) => c === '8');
  const layer = layerProp ? layerProp[1] : '';

  if (layer === '11_DIEM_NEO_CAP') {
    if (ent.type === 'CIRCLE' || ent.type === 'TEXT') {
      cleatEntities.push(ent);
    } else if (ent.type === 'LINE') {
      const x0 = parseFloat(ent.props.find(([c]) => c === '10')[1]);
      const y0 = parseFloat(ent.props.find(([c]) => c === '20')[1]);
      const x1 = parseFloat(ent.props.find(([c]) => c === '11')[1]);
      const y1 = parseFloat(ent.props.find(([c]) => c === '21')[1]);

      const key = `${x0.toFixed(2)},${y0.toFixed(2)}`;
      if (!bridleLinesByCleat.has(key)) {
        bridleLinesByCleat.set(key, { cx: x0, cy: y0, targets: [] });
      }
      bridleLinesByCleat.get(key).targets.push({ x: x1, y: y1 });
    } else {
      cleatEntities.push(ent);
    }
  } else if (layer === '12_CHI_TIET_GHI_CHU') {
    // We will update note 6 to reflect the 2-leg Y bridle
    if (ent.type === 'TEXT') {
      const textProp = ent.props.find(([c]) => c === '1');
      if (textProp && textProp[1].includes('day chan vit toi')) {
        textProp[1] = 'Cap neo chạc chu Y (2 nhanh, goc ~60 do) moc vao 2 tai neo tren ong 40x60. Ong 40x60 lam dam phan tai truyen deu sang 12 dam C52.';
      }
    }
    otherEntities.push(ent);
  } else {
    otherEntities.push(ent);
  }
}

console.log(`Found ${bridleLinesByCleat.size} cleats with bridle lines.`);

// For each cleat, generate EXACTLY 2 BRIDLE LEGS (chạc chữ Y)
const newBridleEntities = [];

for (const [key, data] of bridleLinesByCleat.entries()) {
  const { cx, cy, targets } = data;

  // Find matching cleat from json to know edge
  const cleatMeta = jsonData.cleats.find((c) => Math.hypot(c.x - cx, c.y - cy) < 500);
  const edge = cleatMeta ? cleatMeta.edge : 'bottom';

  let pick1, pick2;

  if (edge === 'left' || edge === 'right') {
    // End face: targets are on 2 rows. Group by y
    const yGroups = new Map();
    for (const t of targets) {
      const yKey = Math.round(t.y / 100) * 100;
      if (!yGroups.has(yKey)) yGroups.set(yKey, []);
      yGroups.get(yKey).push(t);
    }
    const rows = [...yGroups.values()];
    if (rows.length >= 2) {
      // Pick the target in each row that is closest to cx (the edge of the raft)
      rows[0].sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
      rows[1].sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
      pick1 = rows[0][0];
      pick2 = rows[1][0];
    } else {
      targets.sort((a, b) => a.y - b.y);
      pick1 = targets[0];
      pick2 = targets[targets.length - 1];
    }
  } else {
    // Long edge (top or bottom): targets along x
    // Sort by x
    targets.sort((a, b) => a.x - b.x);
    const n = targets.length;
    if (n >= 4) {
      // Pick 2 points spanning ~2 to 4 bays around center (e.g. index 3 and 8 for 12 points, span ~3.6m)
      const i1 = Math.max(0, Math.floor(n * 0.3));
      const i2 = Math.min(n - 1, Math.ceil(n * 0.7));
      pick1 = targets[i1];
      pick2 = targets[i2];
    } else if (n >= 2) {
      pick1 = targets[0];
      pick2 = targets[n - 1];
    } else {
      pick1 = targets[0];
      pick2 = targets[0];
    }
  }

  const N = (v) => (Math.round(v * 100) / 100).toString();

  // Bridle leg 1
  newBridleEntities.push({
    type: 'LINE',
    props: [
      ['8', '11_DIEM_NEO_CAP'],
      ['10', N(cx)], ['20', N(cy)], ['30', '0'],
      ['11', N(pick1.x)], ['21', N(pick1.y)], ['31', '0']
    ]
  });

  // Bridle leg 2
  newBridleEntities.push({
    type: 'LINE',
    props: [
      ['8', '11_DIEM_NEO_CAP'],
      ['10', N(cx)], ['20', N(cy)], ['30', '0'],
      ['11', N(pick2.x)], ['21', N(pick2.y)], ['31', '0']
    ]
  });

  // Add small circles/marks at the 2 connection padeyes on the tube
  newBridleEntities.push({
    type: 'CIRCLE',
    props: [
      ['8', '11_DIEM_NEO_CAP'],
      ['10', N(pick1.x)], ['20', N(pick1.y)], ['30', '0'],
      ['40', '120']
    ]
  });
  newBridleEntities.push({
    type: 'CIRCLE',
    props: [
      ['8', '11_DIEM_NEO_CAP'],
      ['10', N(pick2.x)], ['20', N(pick2.y)], ['30', '0'],
      ['40', '120']
    ]
  });
}

// Assemble updated entities
const allUpdatedEntities = [
  ...otherEntities,
  ...cleatEntities,
  ...newBridleEntities
];

// Build output DXF string
let outDxf = '';
for (const [c, v] of beforeEntities) {
  outDxf += `${c}\n${v}\n`;
}
outDxf += `0\nSECTION\n2\nENTITIES\n`;
for (const ent of allUpdatedEntities) {
  outDxf += `0\n${ent.type}\n`;
  for (const [c, v] of ent.props) {
    outDxf += `${c}\n${v}\n`;
  }
}
outDxf += `0\nENDSEC\n`;
for (const [c, v] of afterEntities) {
  outDxf += `${c}\n${v}\n`;
}

// Write back to docs/be1-ong-40x60
const outDxfPath = path.join(here, '../docs/be1-ong-40x60/be1_ong_40x60.dxf');
fs.writeFileSync(outDxfPath, outDxf, 'utf8');
console.log(`Successfully wrote updated DXF with 2-leg Y bridles to ${outDxfPath}`);

// Also copy to user target folder
const targetFolder = 'E:/Out Job/Chu Giap/Hồ Huổi Vanh/bè pin/Be 1';
if (fs.existsSync(targetFolder)) {
  fs.writeFileSync(path.join(targetFolder, 'be1_ong_40x60.dxf'), outDxf, 'utf8');
  console.log(`Copied updated DXF to ${targetFolder}`);
}
