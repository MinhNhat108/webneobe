const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\nhatm\\OneDrive\\Desktop\\CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf', { encoding: 'latin1' });

let idx = 0;
let hatchIdx = 0;
while ((idx = content.indexOf('HATCH\r\n', idx)) !== -1) {
  const nextEnt = content.indexOf('\r\n  0\r\n', idx + 10);
  const end = nextEnt !== -1 ? nextEnt : idx + 3000;
  const hStr = content.substring(idx - 7, end);
  if (hStr.includes('64893') || hStr.includes('60225')) {
    console.log(`\n=== HATCH ${hatchIdx} (len ${hStr.length}) ===`);
    console.log(hStr);
  }
  hatchIdx++;
  idx += 10;
}
