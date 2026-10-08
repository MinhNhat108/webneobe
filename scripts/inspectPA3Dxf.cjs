const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function inspect() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let code = null;
  let curEntity = null;
  let inEntities = false;
  let inBlocks = false;
  let section = '';
  
  const layers = new Set();
  const texts = [];
  const dimensions = [];
  const inserts = [];

  let prevCode = null;
  for await (const line of rl) {
    lineCount++;
    const trimmed = line.trim();
    if (code === null) {
      code = trimmed;
    } else {
      const val = trimmed;
      if (code === '0' && val === 'SECTION') {
        section = 'WAIT_NAME';
      } else if (code === '2' && section === 'WAIT_NAME') {
        section = val;
      } else if (code === '0' && val === 'ENDSEC') {
        section = '';
      }

      if (code === '8') {
        layers.add(val);
      }

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curEntity) {
            if (curEntity.type === 'TEXT' || curEntity.type === 'MTEXT') {
              texts.push(curEntity);
            } else if (curEntity.type === 'DIMENSION') {
              dimensions.push(curEntity);
            } else if (curEntity.type === 'INSERT') {
              inserts.push(curEntity);
            }
          }
          curEntity = { type: val, layer: '', text: '', x: 0, y: 0, name: '' };
        } else if (curEntity) {
          if (code === '8') curEntity.layer = val;
          else if (code === '1') curEntity.text = val;
          else if (code === '2') curEntity.name = val;
          else if (code === '10') curEntity.x = parseFloat(val);
          else if (code === '20') curEntity.y = parseFloat(val);
        }
      }

      code = null;
    }
  }

  console.log(`Total lines read: ${lineCount}`);
  console.log('Layers found:', Array.from(layers).sort());
  console.log(`Texts count: ${texts.length}`);
  console.log(`Dimensions count: ${dimensions.length}`);
  console.log(`Inserts count: ${inserts.length}`);

  console.log('\n--- SAMPLE TEXTS ---');
  texts.slice(0, 50).forEach(t => {
    console.log(`[${t.layer}] (${t.x.toFixed(1)}, ${t.y.toFixed(1)}): ${t.text}`);
  });

  // Filter texts that might be raft labels
  console.log('\n--- RAFT LABELS / CIRCLE NUMBERS ---');
  texts.filter(t => /^(BÈ|\d+|PHAO|MB|PA)/i.test(t.text)).forEach(t => {
    console.log(`[${t.layer}] (${t.x.toFixed(1)}, ${t.y.toFixed(1)}): "${t.text}"`);
  });

  // Unique insert block names
  const blockCounts = {};
  inserts.forEach(ins => {
    blockCounts[ins.name] = (blockCounts[ins.name] || 0) + 1;
  });
  console.log('\n--- TOP INSERT BLOCKS ---');
  Object.entries(blockCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => console.log(`  ${name}: ${count}`));
}

inspect().catch(console.error);
