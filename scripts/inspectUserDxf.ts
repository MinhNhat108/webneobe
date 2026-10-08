import fs from 'node:fs';

const path = 'C:/Users/nhatm/OneDrive/Desktop/mat-bang-coc-neo_HV-FPV-2026_20261008.dxf';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  console.log('File size:', content.length);
  const piles = content.match(/HV-P\d+/g) || [];
  console.log('Total pile matches:', piles.length, 'unique:', new Set(piles).size);
  const beMatches = content.match(/BE \d+/g) || [];
  console.log('BE matches:', new Set(beMatches));
} else {
  console.log('File does not exist');
}
