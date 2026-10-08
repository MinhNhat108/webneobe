const fs = require('fs');

const srcPath = 'C:/Users/nhatm/OneDrive/Desktop/CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ PA3.dxf';
const outPath = 'C:/Users/nhatm/OneDrive/Desktop/CHUGIAP-HOHUOIVANH ver 4 - Floor Plan - BỐ TRÍ PHAO BÈ PA4.dxf';
const projectPath = 'E:/Out Job/Chu Giap/Hồ Huổi Vanh/bè pin/CHUGIAP-HOHUOIVANH ver 4 - Floor Plan - BỐ TRÍ PHAO BÈ PA4.dxf';

let content = fs.readFileSync(srcPath, 'latin1');
console.log('Source size:', content.length);

// Helper to replace exact entity block by handle
function replaceEntityByHandle(handle, transformFn) {
  const needle = `  5\r\n${handle}\r\n`;
  const idx = content.indexOf(needle);
  if (idx === -1) throw new Error(`Handle ${handle} not found!`);
  const entStart = content.lastIndexOf('\r\n  0\r\n', idx);
  const entEnd = content.indexOf('\r\n  0\r\n', idx);
  if (entStart === -1 || entEnd === -1) throw new Error(`Could not bound entity ${handle}`);

  const originalBlock = content.substring(entStart, entEnd);
  const modifiedBlock = transformFn(originalBlock);
  content = content.substring(0, entStart) + modifiedBlock + content.substring(entEnd);
  console.log(`Successfully updated handle ${handle}`);
}

// 1. DA16: North line of Bè 10
replaceEntityByHandle('DA16', block => {
  return block.replace('11\r\n64893.16782368162\r\n 21\r\n208761.509572451', '11\r\n133285.6678236833\r\n 21\r\n208761.5095724508');
});

// 2. DA18: West line of Bè 11
replaceEntityByHandle('DA18', block => {
  return block.replace('21\r\n226030.7997271627', '21\r\n208761.5095724508');
});

// 3. DA19: South line of Bè 11 (now notch at y=208761)
replaceEntityByHandle('DA19', block => {
  let b = block.replace(' 20\r\n226030.7997271627', ' 20\r\n208761.5095724508');
  b = b.replace(' 11\r\n133285.667823683', ' 11\r\n64893.16782368162');
  b = b.replace(' 21\r\n226030.7997271627', ' 21\r\n208761.5095724508');
  return b;
});

// 4. DA1A: East line of Bè 11
replaceEntityByHandle('DA1A', block => {
  return block.replace(' 20\r\n226030.7997271627', ' 20\r\n208761.5095724508');
});

// 5. DA44: Cable across gap
replaceEntityByHandle('DA44', block => {
  return block.replace('21\r\n208907.0785924254', '21\r\n208761.5095724508');
});

// 6. HATCH 3 (handle A5): extend down to y=208761.5095724510
replaceEntityByHandle('A5', block => {
  return block.replace(/226030\.7997271628/g, '208761.5095724510');
});

// 7. MTEXT DA72 ("10" -> "10A") and position
replaceEntityByHandle('DA72', block => {
  let b = block.replace(' 20\r\n163705.4204367962', ' 20\r\n195000.0');
  b = b.replace('  1\r\n10\r\n', '  1\r\n10A\r\n');
  return b;
});

// 8. INSERT DA71 (Tag 7 position)
replaceEntityByHandle('DA71', block => {
  return block.replace(' 20\r\n156806.6024703813', ' 20\r\n188100.0');
});

// 9. MTEXT DA74 ("11" -> empty / hidden)
replaceEntityByHandle('DA74', block => {
  let b = block.replace(' 10\r\n67143.44372512538', ' 10\r\n-999999.0');
  b = b.replace(' 20\r\n261134.2949745367', ' 20\r\n-999999.0');
  b = b.replace('  1\r\n11\r\n', '  1\r\n \r\n');
  return b;
});

// 10. INSERT DA73 (Tag 8 hidden)
replaceEntityByHandle('DA73', block => {
  let b = block.replace(' 10\r\n77055.17789253188', ' 10\r\n-999999.0');
  b = b.replace(' 20\r\n254235.4770081218', ' 20\r\n-999999.0');
  return b;
});

// 11. DIMENSION DAEA (17.27m gap dimension hidden)
replaceEntityByHandle('DAEA', block => {
  let b = block.replace(' 10\r\n115573.0307944263', ' 10\r\n-999999.0');
  b = b.replace(' 20\r\n226030.7997271628', ' 20\r\n-999999.0');
  b = b.replace(' 11\r\n110094.2431046015', ' 11\r\n-999999.0');
  b = b.replace(' 21\r\n217396.1546498069', ' 21\r\n-999999.0');
  return b;
});

// 12. Title updates (PA3 -> PA4)
content = content.replace(/PHƯƠNG ÁN 3/g, 'PHƯƠNG ÁN 4');
content = content.replace(/PHUONG AN 3/g, 'PHUONG AN 4');
content = content.replace(/PA3/g, 'PA4');

fs.writeFileSync(outPath, content, 'latin1');
console.log('Saved to Desktop:', outPath);

fs.writeFileSync(projectPath, content, 'latin1');
console.log('Saved to Project:', projectPath);
