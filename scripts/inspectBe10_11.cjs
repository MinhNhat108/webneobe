const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function inspectBe10_11() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let code = null;
  let section = '';
  let curEnt = null;
  const entities = [];

  for await (const line of rl) {
    const tr = line.trim();
    if (code === null) code = tr;
    else {
      if (code === '0' && tr === 'SECTION') section = 'WAIT';
      else if (code === '2' && section === 'WAIT') section = tr;
      else if (code === '0' && tr === 'ENDSEC') section = '';

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curEnt) entities.push(curEnt);
          curEnt = { type: tr, props: [] };
        } else if (curEnt) {
          curEnt.props.push([code, tr]);
        }
      }
      code = null;
    }
  }
  if (curEnt) entities.push(curEnt);

  console.log(`Total entities: ${entities.length}`);

  // Find entities in the region of Bè 10 and Bè 11:
  // x: [50, 180] m -> [50000, 180000]
  // y: [100, 290] m -> [100000, 290000]
  const regionEnts = entities.filter(e => {
    // Check if any x,y point is in the region
    let inRegion = false;
    for (let i = 0; i < e.props.length; i++) {
      if (e.props[i][0] === '10') {
        const x = parseFloat(e.props[i][1]);
        const yProp = e.props.find(([c]) => c === '20');
        if (yProp) {
          const y = parseFloat(yProp[1]);
          if (x >= 40000 && x <= 190000 && y >= 90000 && y <= 300000) {
            inRegion = true;
            break;
          }
        }
      }
    }
    return inRegion;
  });

  console.log(`Entities in Bè 10-11 region: ${regionEnts.length}`);
  const byLayerAndType = {};
  regionEnts.forEach(e => {
    const layer = (e.props.find(([c]) => c === '8') || ['', ''])[1];
    const key = `${layer} | ${e.type}`;
    byLayerAndType[key] = (byLayerAndType[key] || 0) + 1;
  });
  console.log('By layer and type:', byLayerAndType);

  // Print details of non-contour entities in this region
  regionEnts.filter(e => {
    const layer = (e.props.find(([c]) => c === '8') || ['', ''])[1];
    return !layer.startsWith('C-TOPO');
  }).forEach((e, idx) => {
    const layer = (e.props.find(([c]) => c === '8') || ['', ''])[1];
    const text = (e.props.find(([c]) => c === '1') || ['', ''])[1];
    console.log(`\nEnt ${idx}: ${e.type} on layer "${layer}" text="${text}"`);
    // print coordinates
    e.props.filter(([c]) => ['10', '20', '11', '21', '2'].includes(c)).forEach(([c, v]) => {
      console.log(`   ${c}: ${v}`);
    });
  });
}

inspectBe10_11().catch(console.error);
