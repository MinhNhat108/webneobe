const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function parsePolylines() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let section = '';
  let curEntity = null;
  const entities = [];
  let code = null;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (code === null) {
      code = trimmed;
    } else {
      const val = trimmed;
      if (code === '0' && val === 'SECTION') section = 'WAIT';
      else if (code === '2' && section === 'WAIT') section = val;
      else if (code === '0' && val === 'ENDSEC') section = '';

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curEntity) entities.push(curEntity);
          curEntity = { type: val, layer: '', points: [], props: {} };
        } else if (curEntity) {
          if (code === '8') curEntity.layer = val;
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
  if (curEntity) entities.push(curEntity);

  console.log(`Total entities parsed: ${entities.length}`);
  const polys = entities.filter(e => e.type === 'LWPOLYLINE' || e.type === 'POLYLINE');
  console.log(`Polylines count: ${polys.length}`);

  // Group by layer
  const layerPolys = {};
  polys.forEach(p => {
    layerPolys[p.layer] = (layerPolys[p.layer] || 0) + 1;
  });
  console.log('Polylines by layer:', layerPolys);

  // Inspect polylines on raft layers (e.g. A-DETL, A-GENM, etc.)
  for (const layer of Object.keys(layerPolys)) {
    if (layer.startsWith('C-TOPO')) continue; // skip contours
    const list = polys.filter(p => p.layer === layer);
    console.log(`\nLayer ${layer} has ${list.length} polylines:`);
    list.forEach((p, idx) => {
      const xs = p.points.map(pt => pt.x);
      const ys = p.points.map(pt => pt.y);
      if (xs.length === 0) return;
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = (maxX - minX) / 1000;
      const h = (maxY - minY) / 1000;
      const cx = (minX + maxX) / 2000;
      const cy = (minY + maxY) / 2000;
      console.log(`  [${idx}] pts=${p.points.length}, Box: [${(minX/1000).toFixed(1)}, ${(minY/1000).toFixed(1)}] to [${(maxX/1000).toFixed(1)}, ${(maxY/1000).toFixed(1)}], Size: ${w.toFixed(1)}m x ${h.toFixed(1)}m, Centroid: (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
    });
  }
}

parsePolylines().catch(console.error);
