const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function inspectHatchAndDims() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let section = '';
  let curEntity = null;
  const hatches = [];
  const dimensions = [];
  let code = null;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (code === null) code = trimmed;
    else {
      const val = trimmed;
      if (code === '0' && val === 'SECTION') section = 'WAIT';
      else if (code === '2' && section === 'WAIT') section = val;
      else if (code === '0' && val === 'ENDSEC') section = '';

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curEntity) {
            if (curEntity.type === 'HATCH') hatches.push(curEntity);
            if (curEntity.type === 'DIMENSION') dimensions.push(curEntity);
          }
          curEntity = { type: val, layer: '', props: {}, points: [] };
        } else if (curEntity) {
          if (code === '8') curEntity.layer = val;
          if (code === '1') curEntity.text = val;
          if (code === '10') curEntity.curX = parseFloat(val);
          if (code === '20') {
            curEntity.curY = parseFloat(val);
            if (curEntity.curX !== undefined) {
              curEntity.points.push({ x: curEntity.curX, y: curEntity.curY });
              delete curEntity.curX;
            }
          }
        }
      }
      code = null;
    }
  }
  if (curEntity) {
    if (curEntity.type === 'HATCH') hatches.push(curEntity);
    if (curEntity.type === 'DIMENSION') dimensions.push(curEntity);
  }

  console.log(`\n=== 9 DIMENSIONS ===`);
  dimensions.forEach((d, i) => {
    console.log(`Dim ${i}: text="${d.text}", layer=${d.layer}, pts=${d.points.map(p => `(${(p.x/1000).toFixed(1)}, ${(p.y/1000).toFixed(1)})`).join(' ')}`);
  });

  console.log(`\n=== 11 HATCHES (RAFTS) ===`);
  hatches.forEach((h, i) => {
    const xs = h.points.map(p => p.x);
    const ys = h.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = (maxX - minX) / 1000;
    const hgt = (maxY - minY) / 1000;
    const cx = (minX + maxX) / 2000;
    const cy = (minY + maxY) / 2000;
    console.log(`Hatch ${i} [${h.layer}]: ${h.points.length} pts, Box: [${(minX/1000).toFixed(1)}, ${(minY/1000).toFixed(1)}] to [${(maxX/1000).toFixed(1)}, ${(maxY/1000).toFixed(1)}], Size: ${w.toFixed(1)}m x ${hgt.toFixed(1)}m, Centroid: (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
  });
}

inspectHatchAndDims().catch(console.error);
