const fs = require('fs');
const path = require('path');

const srcDxf = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';
const outDxf = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 4 - Floor Plan - BỐ TRÍ PHAO BÈ PA4.dxf';
const projectOutDxf = 'E:\\Out Job\\Chu Giap\\Hồ Huổi Vanh\\bè pin\\CHUGIAP-HOHUOIVANH ver 4 - Floor Plan - BỐ TRÍ PHAO BÈ PA4.dxf';

function run() {
  console.log('Reading source DXF...');
  const content = fs.readFileSync(srcDxf, { encoding: 'latin1' });

  // Locate the ENTITIES section header exactly
  const matchEntities = content.match(/(\r?\n)\s*0\r?\nSECTION\r?\n\s*2\r?\nENTITIES\r?\n/);
  if (!matchEntities) throw new Error('Could not find ENTITIES section');

  const startIdx = matchEntities.index + matchEntities[0].length;
  const beforeEntities = content.substring(0, startIdx);

  // Locate the ENDSEC after startIdx
  const endSecMatch = content.substring(startIdx).match(/(\r?\n)\s*0\r?\nENDSEC\r?\n/);
  if (!endSecMatch) throw new Error('Could not find ENDSEC for ENTITIES section');

  const endIdx = startIdx + endSecMatch.index + endSecMatch[1].length; // keep newline before ENDSEC
  const entitiesContent = content.substring(startIdx, endIdx);
  const afterEntities = content.substring(endIdx); // starts with 0\r\nENDSEC...

  console.log(`beforeEntities length: ${beforeEntities.length}`);
  console.log(`entitiesContent length: ${entitiesContent.length}`);
  console.log(`afterEntities length: ${afterEntities.length}`);

  // Parse entities in entitiesContent
  const lines = entitiesContent.split(/\r?\n/);
  const entities = [];
  let curEnt = null;

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const val = lines[i + 1].trim();

    if (code === '0') {
      if (curEnt) entities.push(curEnt);
      curEnt = { type: val, props: [] };
    } else if (curEnt) {
      curEnt.props.push([code, val]);
    }
  }
  if (curEnt) entities.push(curEnt);

  console.log(`Parsed ${entities.length} entities from ENTITIES section.`);

  // Transform entities
  const newEntities = [];
  for (const ent of entities) {
    const layer = (ent.props.find(([c]) => c === '8') || ['', ''])[1];
    const text = (ent.props.find(([c]) => c === '1') || ['', ''])[1];
    const blockName = (ent.props.find(([c]) => c === '2') || ['', ''])[1];

    // 1. Skip Dim 3 (DIMBLOCK4 - 17.27m dimension)
    if (ent.type === 'DIMENSION' && blockName.includes('DIMBLOCK4')) {
      console.log('Skipping DIMBLOCK4 (17.27m dimension)');
      continue;
    }

    // 2. Skip Bè 11 MText and Tag circle
    if (ent.type === 'MTEXT' && text === '11') {
      console.log('Skipping MText "11"');
      continue;
    }
    if (ent.type === 'INSERT' && blockName.includes('tag ten be')) {
      const yProp = ent.props.find(([c]) => c === '20');
      if (yProp && Math.abs(parseFloat(yProp[1]) - 254235.48) < 500) {
        console.log('Skipping Tag 8 (Bè 11 circle)');
        continue;
      }
    }

    // 3. Rename Bè 10 -> "10A" and move to center
    if (ent.type === 'MTEXT' && text === '10') {
      console.log('Updating MText "10" -> "10A"');
      const textProp = ent.props.find(([c]) => c === '1');
      if (textProp) textProp[1] = '10A';
      const yProp = ent.props.find(([c]) => c === '20');
      if (yProp) yProp[1] = (195000.0).toString();
      newEntities.push(ent);
      continue;
    }
    if (ent.type === 'INSERT' && blockName.includes('tag ten be')) {
      const yProp = ent.props.find(([c]) => c === '20');
      if (yProp && Math.abs(parseFloat(yProp[1]) - 156806.60) < 500) {
        console.log('Repositioning Tag 7 to center of Bè 10A');
        yProp[1] = (188100.0).toString();
        newEntities.push(ent);
        continue;
      }
    }

    // 4. Remove inner facing edges of Bè 10 and Bè 11 on A-DETL-THIN
    if (ent.type === 'LINE' && layer === 'A-DETL-THIN') {
      const p10 = ent.props.find(([c]) => c === '10');
      const p20 = ent.props.find(([c]) => c === '20');
      const p11 = ent.props.find(([c]) => c === '11');
      const p21 = ent.props.find(([c]) => c === '21');

      if (p10 && p20 && p11 && p21) {
        const x0 = parseFloat(p10[1]), y0 = parseFloat(p20[1]);
        const x1 = parseFloat(p11[1]), y1 = parseFloat(p21[1]);

        // North edge Bè 10: y = 208761.51
        if (Math.abs(y0 - 208761.51) < 1 && Math.abs(y1 - 208761.51) < 1) {
          console.log('Skipping North edge of Bè 10');
          continue;
        }
        // South edge Bè 11: y = 226030.80
        if (Math.abs(y0 - 226030.80) < 1 && Math.abs(y1 - 226030.80) < 1) {
          console.log('Skipping South edge of Bè 11');
          continue;
        }
        // West edge Bè 10
        if (Math.abs(x0 - 64893.17) < 1 && Math.abs(x1 - 64893.17) < 1) {
          console.log('Replacing West edge of Bè 10');
          continue;
        }
        // West edge Bè 11
        if (Math.abs(x0 - 60225.67) < 1 && Math.abs(x1 - 60225.67) < 1) {
          console.log('Replacing West edge of Bè 11');
          continue;
        }
        // East edge Bè 11
        if (Math.abs(x0 - 133285.67) < 1 && Math.abs(x1 - 133285.67) < 1) {
          console.log('Replacing East edge of Bè 11');
          continue;
        }
      }
    }

    // 5. Cable lines on A-DETL
    if (ent.type === 'LINE' && layer === 'A-DETL') {
      const p20 = ent.props.find(([c]) => c === '20');
      const p21 = ent.props.find(([c]) => c === '21');
      if (p20 && p21) {
        const y0 = parseFloat(p20[1]), y1 = parseFloat(p21[1]);
        if ((Math.abs(y0 - 226030.80) < 10 && Math.abs(y1 - 208907.08) < 10) ||
            (Math.abs(y1 - 226030.80) < 10 && Math.abs(y0 - 208907.08) < 10)) {
          console.log('Skipping cable across gap');
          continue;
        }
        if ((Math.abs(y0 - 282030.80) < 10 && Math.abs(y1 - 226030.80) < 10) ||
            (Math.abs(y1 - 282030.80) < 10 && Math.abs(y0 - 226030.80) < 10)) {
          console.log('Skipping old Bè 11 cable');
          continue;
        }
      }
    }

    // 6. Hatches for Bè 10 and 11
    if (ent.type === 'HATCH' && layer === 'A-DETL-GENF') {
      const p10s = ent.props.filter(([c]) => c === '10').map(([c, v]) => parseFloat(v));
      const p20s = ent.props.filter(([c]) => c === '20').map(([c, v]) => parseFloat(v));
      const minY = Math.min(...p20s), maxY = Math.max(...p20s);
      if (minY >= 95000 && maxY <= 215000 && Math.max(...p10s) < 180000) {
        console.log('Skipping old Hatch for Bè 10');
        continue;
      }
      if (minY >= 220000 && maxY <= 285000 && Math.max(...p10s) < 180000) {
        console.log('Skipping old Hatch for Bè 11');
        continue;
      }
    }

    // 7. Title text
    if (ent.type === 'MTEXT' && text.includes('PA3')) {
      const textProp = ent.props.find(([c]) => c === '1');
      if (textProp) {
        console.log(`Updating title: "${textProp[1]}" -> PA4`);
        textProp[1] = textProp[1].replace(/PA3/g, 'PA4');
      }
    }

    newEntities.push(ent);
  }

  const fmtCode = (c) => c.toString().padStart(3, ' ');

  // Helper
  const createLine = (layer, x0, y0, x1, y1) => ({
    type: 'LINE',
    props: [
      ['5', 'B001'],
      ['100', 'AcDbEntity'],
      ['8', layer],
      ['100', 'AcDbLine'],
      ['10', x0.toFixed(4)], ['20', y0.toFixed(4)], ['30', '0.0'],
      ['11', x1.toFixed(4)], ['21', y1.toFixed(4)], ['31', '0.0']
    ]
  });

  // Add boundary lines for merged Bè 10A:
  newEntities.push(createLine('A-DETL-THIN', 64893.1678, 100761.5096, 64893.1678, 208761.5096));
  newEntities.push(createLine('A-DETL-THIN', 64893.1678, 208761.5096, 60225.6678, 208761.5096));
  newEntities.push(createLine('A-DETL-THIN', 60225.6678, 208761.5096, 60225.6678, 282030.7997));
  newEntities.push(createLine('A-DETL-THIN', 173120.1309, 208761.5096, 133285.6678, 208761.5096));
  newEntities.push(createLine('A-DETL-THIN', 133285.6678, 208761.5096, 133285.6678, 282030.7997));

  // Straight cable through Bè 10A
  newEntities.push(createLine('A-DETL', 96755.6678, 282030.7997, 101435.6678, 100761.5096));

  // Merged HATCH for Bè 10A
  const poly10A = [
    [64893.1678, 100761.5096],
    [137978.1678, 100761.5096],
    [137978.1678, 160761.5096],
    [173120.1309, 160761.5096],
    [173120.1309, 208761.5096],
    [133285.6678, 208761.5096],
    [133285.6678, 282030.7997],
    [60225.6678, 282030.7997],
    [60225.6678, 208761.5096],
    [64893.1678, 208761.5096]
  ];

  const hatchProps = [
    ['5', 'B002'],
    ['100', 'AcDbEntity'],
    ['8', 'A-DETL-GENF'],
    ['62', '8'],
    ['100', 'AcDbHatch'],
    ['10', '0.0'], ['20', '0.0'], ['30', '0.0'],
    ['210', '0.0'], ['220', '0.0'], ['230', '1.0'],
    ['2', 'SOLID'],
    ['70', '1'],
    ['71', '0'],
    ['91', '1'],
    ['92', '1'],
    ['72', '0'],
    ['73', '1'],
    ['93', poly10A.length.toString()]
  ];
  poly10A.forEach(([x, y]) => {
    hatchProps.push(['10', x.toFixed(4)], ['20', y.toFixed(4)]);
  });
  hatchProps.push(['97', '0']);

  newEntities.push({
    type: 'HATCH',
    props: hatchProps
  });

  // Re-assemble
  let middleStr = '';
  for (const ent of newEntities) {
    middleStr += `  0\r\n${ent.type}\r\n`;
    for (const [c, v] of ent.props) {
      middleStr += `${fmtCode(c)}\r\n${v}\r\n`;
    }
  }

  const finalDxf = beforeEntities + middleStr + afterEntities;

  fs.writeFileSync(outDxf, finalDxf, { encoding: 'latin1' });
  console.log(`Saved PA4 DXF to: ${outDxf}`);

  fs.mkdirSync(path.dirname(projectOutDxf), { recursive: true });
  fs.writeFileSync(projectOutDxf, finalDxf, { encoding: 'latin1' });
  console.log(`Saved PA4 DXF to: ${projectOutDxf}`);
}

run();
