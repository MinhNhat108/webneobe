const fs = require('fs');
const content = fs.readFileSync('C:/Users/nhatm/OneDrive/Desktop/CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf', 'latin1');
const idx = content.indexOf('$ACADVER');
console.log('ACADVER:\n' + content.substring(idx - 10, idx + 80));
const idx2 = content.indexOf('$HANDSEED');
console.log('HANDSEED:\n' + content.substring(idx2 - 10, idx2 + 80));
