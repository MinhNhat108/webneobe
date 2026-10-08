const fs = require('fs');
const readline = require('readline');

const dxfPath = 'C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';

async function extractHatchLoops() {
  const fileStream = fs.createReadStream(dxfPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let code = null;
  let section = '';
  let inHatch = false;
  let curHatch = null;
  const hatches = [];

  for await (const line of rl) {
    const tr = line.trim();
    if (code === null) code = tr;
    else {
      if (code === '0' && tr === 'SECTION') section = 'WAIT';
      else if (code === '2' && section === 'WAIT') section = tr;
      else if (code === '0' && tr === 'ENDSEC') section = '';

      if (section === 'ENTITIES') {
        if (code === '0') {
          if (curHatch) hatches.push(curHatch);
          if (tr === 'HATCH') {
            inHatch = true;
            curHatch = { layer: '', loops: [], curLoop: [] };
          } else {
            inHatch = false;
            curHatch = null;
          }
        } else if (inHatch && curHatch) {
          if (code === '8') curHatch.layer = tr;
          if (code === '92') {
            // new loop
            if (curHatch.curLoop.length > 0) curHatch.loops.push(curHatch.curLoop);
            curHatch.curLoop = [];
          }
          if (code === '10') curHatch.curX = parseFloat(tr);
          if (code === '20') {
            curHatch.curY = parseFloat(tr);
            if (curHatch.curX !== undefined) {
              curHatch.curLoop.push({ x: curHatch.curX, y: curHatch.curY });
              delete curHatch.curX;
            }
          }
        }
      }
      code = null;
    }
  }
  if (curHatch) hatches.push(curHatch);

  console.log(`Extracted ${hatches.length} hatches.`);
  hatches.forEach((h, i) => {
    if (h.curLoop.length > 0) h.loops.push(h.curLoop);
    const allPts = h.loops.flat();
    const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    console.log(`\nHATCH ${i} [${h.layer}]: ${h.loops.length} loops, total ${allPts.length} pts`);
    console.log(`  BBox: [${(minX/1000).toFixed(1)}, ${(minY/1000).toFixed(1)}] -> [${(maxX/1000).toFixed(1)}, ${(maxY/1000).toFixed(1)}], Dim: ${((maxX-minX)/1000).toFixed(1)}m x ${((maxY-minY)/1000).toFixed(1)}m`);
    h.loops.forEach((lp, li) => {
      console.log(`  Loop ${li} (${lp.length} pts):`);
      lp.forEach(p => console.log(`    (${(p.x/1000).toFixed(3)}, ${(p.y/1000).toFixed(3)})`));
    });
  });
}

extractHatchLoops().catch(console.error);
