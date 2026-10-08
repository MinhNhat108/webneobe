const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function inspectTags() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let code = null;
  let section = '';
  let curEnt = null;
  const tagInserts = [];
  const mtexts = [];
  const dims = [];

  for await (const line of rl) {
    const tr = line.trim();
    if (code === null) code = tr;
    else {
      if (code === '0' && tr === 'SECTION') section = 'WAIT';
      else if (code === '2' && section === 'WAIT') section = tr;
      else if (code === '0' && tr === 'ENDSEC') section = '';

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curEnt) {
            if (curEnt.type === 'INSERT' && curEnt.name && curEnt.name.includes('tag ten be')) tagInserts.push(curEnt);
            if (curEnt.type === 'MTEXT') mtexts.push(curEnt);
            if (curEnt.type === 'DIMENSION') dims.push(curEnt);
          }
          curEnt = { type: tr };
        } else if (curEnt) {
          if (code === '2') curEnt.name = tr;
          if (code === '1') curEnt.text = tr;
          if (code === '8') curEnt.layer = tr;
          if (code === '10') curEnt.x = parseFloat(tr);
          if (code === '20') curEnt.y = parseFloat(tr);
          if (code === '11') curEnt.x1 = parseFloat(tr);
          if (code === '21') curEnt.y1 = parseFloat(tr);
          if (code === '13') curEnt.x3 = parseFloat(tr);
          if (code === '23') curEnt.y3 = parseFloat(tr);
          if (code === '14') curEnt.x4 = parseFloat(tr);
          if (code === '24') curEnt.y4 = parseFloat(tr);
          if (code === '42') curEnt.dimVal = parseFloat(tr); // actual dimension measurement
        }
      }
      code = null;
    }
  }

  console.log(`\n=== TAG TEN BE INSERTS (${tagInserts.length}) ===`);
  tagInserts.forEach((t, i) => {
    console.log(`  Tag ${i}: pos=(${(t.x/1000).toFixed(1)}, ${(t.y/1000).toFixed(1)})`);
  });

  console.log(`\n=== MTEXTS (${mtexts.length}) ===`);
  mtexts.forEach((m, i) => {
    console.log(`  MText ${i} [${m.layer}]: "${m.text}" at (${(m.x/1000).toFixed(1)}, ${(m.y/1000).toFixed(1)})`);
  });

  console.log(`\n=== DIMENSIONS (${dims.length}) ===`);
  dims.forEach((d, i) => {
    console.log(`  Dim ${i} [${d.layer}]: text="${d.text}" val=${d.dimVal ? (d.dimVal/1000).toFixed(2) + 'm' : 'auto'} at (${(d.x/1000).toFixed(1)}, ${(d.y/1000).toFixed(1)}) defpts=(${(d.x3/1000).toFixed(1)}, ${(d.y3/1000).toFixed(1)}) -> (${(d.x4/1000).toFixed(1)}, ${(d.y4/1000).toFixed(1)})`);
  });
}

inspectTags().catch(console.error);
