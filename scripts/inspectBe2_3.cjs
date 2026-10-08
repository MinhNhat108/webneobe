const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function inspectBe2_3() {
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

  // Region around Bè 2 and 3:
  // x: [-140000, 50000]
  // y: [-135000, 60000]
  const regionEnts = entities.filter(e => {
    const layer = (e.props.find(([c]) => c === '8') || ['', ''])[1];
    if (layer.startsWith('C-TOPO')) return false;
    for (let i = 0; i < e.props.length; i++) {
      if (e.props[i][0] === '10') {
        const x = parseFloat(e.props[i][1]);
        const yProp = e.props.find(([c]) => c === '20');
        if (yProp) {
          const y = parseFloat(yProp[1]);
          if (x >= -145000 && x <= 50000 && y >= -135000 && y <= 60000) return true;
        }
      }
    }
    return false;
  });

  console.log(`Entities in Bè 2-3 region: ${regionEnts.length}`);
  regionEnts.forEach((e, idx) => {
    const layer = (e.props.find(([c]) => c === '8') || ['', ''])[1];
    const text = (e.props.find(([c]) => c === '1') || ['', ''])[1];
    console.log(`Ent ${idx}: ${e.type} on "${layer}" text="${text}"`);
    e.props.filter(([c]) => ['10', '20', '11', '21', '2'].includes(c)).forEach(([c, v]) => {
      console.log(`   ${c}: ${v}`);
    });
  });
}

inspectBe2_3().catch(console.error);
