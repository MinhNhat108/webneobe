const fs = require('fs');

const lines = JSON.parse(fs.readFileSync('src/data/huoiVanhCoordinates_v2.json', 'utf8'));

const b5 = lines.filter(l => l.raft === 'BÈ 5');
const b6 = lines.filter(l => l.raft === 'BÈ 6');
const b7 = lines.filter(l => l.raft === 'BÈ 7');

console.log(`Bè 5: ${b5.length} lines.`);
console.log(`Bè 6: ${b6.length} lines.`);
console.log(`Bè 7: ${b7.length} lines.`);

const b5_east = b5.filter(l => l.xRaft > 210);
const b6_west = b6.filter(l => l.xRaft < 260);
const b7_west = b7.filter(l => l.xRaft < 260);

console.log(`\n--- Bè 5 East lines (facing B6/B7) [${b5_east.length}] ---`);
b5_east.forEach(l => console.log(`  ${l.code} (${l.type}): Raft(${l.xRaft.toFixed(1)}, ${l.yRaft.toFixed(1)}) -> Anchor(${l.xAnchor.toFixed(1)}, ${l.yAnchor.toFixed(1)}) span=${l.span ? l.span.toFixed(1) : '?'}m, zAnchor=${l.zAnchor}`));

console.log(`\n--- Bè 6 West lines (facing B5) [${b6_west.length}] ---`);
b6_west.forEach(l => console.log(`  ${l.code} (${l.type}): Raft(${l.xRaft.toFixed(1)}, ${l.yRaft.toFixed(1)}) -> Anchor(${l.xAnchor.toFixed(1)}, ${l.yAnchor.toFixed(1)}) span=${l.span ? l.span.toFixed(1) : '?'}m, zAnchor=${l.zAnchor}`));

console.log(`\n--- Bè 7 West lines (facing B5) [${b7_west.length}] ---`);
b7_west.forEach(l => console.log(`  ${l.code} (${l.type}): Raft(${l.xRaft.toFixed(1)}, ${l.yRaft.toFixed(1)}) -> Anchor(${l.xAnchor.toFixed(1)}, ${l.yAnchor.toFixed(1)}) span=${l.span ? l.span.toFixed(1) : '?'}m, zAnchor=${l.zAnchor}`));

// Check anchor overlap in the channel between B5 and B6/B7
console.log(`\n--- Anchors in the channel between B5 and B6/B7 ---`);
const allChannelAnchors = [...b5_east, ...b6_west, ...b7_west];
for (let i = 0; i < allChannelAnchors.length; i++) {
  for (let j = i + 1; j < allChannelAnchors.length; j++) {
    const a = allChannelAnchors[i];
    const b = allChannelAnchors[j];
    const d = Math.hypot(a.xAnchor - b.xAnchor, a.yAnchor - b.yAnchor);
    if (d < 15) {
      console.log(`  WARNING: Anchor distance ${a.code} (${a.raft}) <-> ${b.code} (${b.raft}) is only ${d.toFixed(1)}m!`);
    }
  }
}

// Check gap between B6 and B7
const b6_top = b6.filter(l => l.yRaft > -170);
const b7_bottom = b7.filter(l => l.yRaft < -140);
console.log(`\n--- Lines in the gap between Bè 6 and Bè 7 ---`);
console.log(`Bè 6 top lines: ${b6_top.length}`);
b6_top.forEach(l => console.log(`  ${l.code} (${l.type}): Raft(${l.xRaft.toFixed(1)}, ${l.yRaft.toFixed(1)}) -> Anchor(${l.xAnchor.toFixed(1)}, ${l.yAnchor.toFixed(1)}) span=${l.span}`));
console.log(`Bè 7 bottom lines: ${b7_bottom.length}`);
b7_bottom.forEach(l => console.log(`  ${l.code} (${l.type}): Raft(${l.xRaft.toFixed(1)}, ${l.yRaft.toFixed(1)}) -> Anchor(${l.xAnchor.toFixed(1)}, ${l.yAnchor.toFixed(1)}) span=${l.span}`));
