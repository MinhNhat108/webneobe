/**
 * Writes the calculation note of the settled design (bored shore piles D350 +
 * RC bases with screw piles) as a Word file, from the same builder as the web
 * note and the calculation workbook (`finalDesignWorkbook.ts`).
 *
 *   npx vite-node scripts/buildFinalDesignDocx.ts
 *
 * Output: docs/mat-bang-neo-9-be/THUYET_MINH_TINH_TOAN.docx and the web
 * attachment public/docs_huoi_vanh/HOHUOIVANH_THUYET_MINH_PHUONG_AN_CHOT.docx.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlignmentType, Document, HeadingLevel, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildFinalDesign, finalDesignNote, vn, FINAL_OPTION_DATE, FINAL_OPTION_TITLE } from '../src/lib/io/finalDesignWorkbook';

const here = path.dirname(fileURLToPath(import.meta.url));
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const d = buildFinalDesign(state, calculateProject(state), batch);
const T = d.totals;

const FONT = 'Times New Roman';
const run = (text: string, opt: { bold?: boolean; size?: number } = {}) => new TextRun({ text, font: FONT, size: opt.size ?? 24, bold: opt.bold });
const para = (text: string, opt: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
  new Paragraph({ children: [run(text, opt)], alignment: opt.align, spacing: { after: opt.after ?? 80 } });
const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [run(text, { bold: true, size: 26 })] });
const bullet = (text: string) => new Paragraph({ children: [run(text)], bullet: { level: 0 }, spacing: { after: 60 } });
const table = (head: string[], rows: Array<Array<string | number>>) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [head, ...rows].map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c) => new TableCell({ children: [new Paragraph({ children: [run(String(c), { size: 18, bold: i === 0 })], alignment: AlignmentType.CENTER })] }))
    }))
  });

const body: Array<Paragraph | Table> = [
  para('THUYẾT MINH TÍNH TOÁN HỆ NEO BÈ', { bold: true, size: 32, align: AlignmentType.CENTER }),
  para(d.name, { bold: true, size: 26, align: AlignmentType.CENTER }),
  para(`Phương án chốt: ${FINAL_OPTION_TITLE}`, { align: AlignmentType.CENTER }),
  para(`Chủ đầu tư chốt ngày ${FINAL_OPTION_DATE} · Mã hồ sơ ${d.code}`, { align: AlignmentType.CENTER, after: 240 })
];
for (const s of finalDesignNote(d)) {
  body.push(heading(s.title));
  for (const l of s.lines) body.push(bullet(l));
}

body.push(heading('Bảng A. Lực dây, cáp và cọc khoan nhồi theo bè'));
body.push(table(
  ['Bè', 'Số dây', 'F (kN)', 'T dây (kN)', 'Cáp', 'HSAT cáp', 'Số cọc', 'D (mm)', 'L_tk (m)', 'Thép chủ', 'BP-1 ngang', 'BP-2 uốn', 'Kết luận'],
  [
    ...d.rafts.map((r) => [r.name, r.lines, vn(r.fEnv_kN), vn(r.tMax_kN), r.cable, vn(r.sfIntact, 2), r.pileCount, Math.round(r.pileD_m * 1000), vn(r.pileL_m), `${r.cage} ${r.grade}`, vn(r.bp1, 2), vn(r.bp2, 2), r.verdict === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT']),
    ['TỔNG', T.lines, '', '', '', '', T.shorePiles, '', '', `${vn(T.shoreLength_m)} m`, '', '', '']
  ]
));
body.push(para(`Cọc khoan nhồi: ${T.shorePiles} cọc, tổng dài ${vn(T.shoreLength_m)} m, ${vn(T.shoreConcrete_m3)} m³ bê tông, ${vn(T.shoreSteel_kg / 1000)} tấn thép. BP-1, BP-2 là mức sử dụng (≤ 1,00 là đạt).`, { size: 20 }));

body.push(heading(`Bảng B. ${T.bases} đế BTCT + vít xoắn`));
body.push(table(
  ['Đế', 'Hai dây neo', 'B (m)', 't (m)', 'Bê tông (m³)', 'Cẩu (tấn)', 'T_v (kN)', 'Nhổ', 'Trượt', 'Lật', '1 vít', 'Kết luận'],
  [
    ...d.schedule.bases.map((b) => [b.baseId, b.code, vn(b.side_m, 2), vn(b.thickness_m, 1), vn(b.concrete_m3, 2), vn(b.liftMass_t), vn(Math.max(...b.combinations.map((c) => c.Tv_kN))),
      vn(b.upliftUtil, 2), vn(b.slideUtil, 2), vn(b.overturnUtil, 2), vn(b.screwUtil, 2), b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT']),
    ['TỔNG', `${T.bases} đế, ${T.screws} vít`, '', '', vn(T.baseConcrete_m3), '', vn(T.upliftDemand_kN, 0), '', '', '', '', '']
  ]
));
body.push(para(`Mỗi đế có 4 vít ống Ø89×5 ren Ø105, ngàm 3 m; tổng ${T.screws} vít, ${vn(T.screwLength_m, 0)} m. Tổng sức chống nhổ ${vn(T.upliftResistance_kN, 0)} kN. Các cột Nhổ, Trượt, Lật, 1 vít là mức sử dụng lớn nhất trên mọi tổ hợp.`, { size: 20 }));

body.push(heading('Bảng C. Khối lượng và báo giá thi công'));
body.push(table(
  ['STT', 'Hạng mục', 'Đơn vị', 'Khối lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)', 'Ghi chú'],
  [
    ...d.cost.lines.map((l) => [l.no, l.item, l.unit, vn(l.quantity), l.rate > 0 ? vn(l.rate, 0) : '-', l.rate > 0 ? vn(l.amount_VND, 0) : '-', l.note]),
    ['', 'Cộng chi phí trực tiếp', '', '', '', vn(d.cost.directTotal_VND, 0), ''],
    ['', `Dự phòng phí ${d.costParams.contingencyPercent}%`, '', '', '', vn(d.cost.contingency_VND, 0), ''],
    ['', d.costParams.includeVat ? `Thuế VAT ${d.costParams.vatPercent}%` : 'Thuế VAT (không tính)', '', '', '', vn(d.cost.vat_VND, 0), ''],
    ['', d.cost.unpriced.length > 0 ? 'TỔNG CỘNG (chưa gồm hạng mục chưa có đơn giá)' : 'TỔNG CỘNG', '', '', '', vn(d.cost.grandTotal_VND, 0), '']
  ]
));
body.push(para('Đơn giá cọc khoan nhồi và sà lan là giá tham khảo thị trường do Chủ đầu tư cung cấp, không phải báo giá nhà thầu. ' +
  (d.cost.unpriced.length > 0 ? `${d.cost.unpriced.length} hạng mục của đế và vít xoắn CHƯA CÓ ĐƠN GIÁ nên chưa nằm trong tổng. ` : '') +
  'Chưa gồm: cáp neo và phụ kiện, tai neo và khóa đầu vít của đế, bích neo đầu cọc, khảo sát, thử tải.', { size: 20 }));
body.push(para('Bảng từng cọc khoan nhồi (231 cọc), từng bước tính của mỗi đế và chiều dài cắt 295 dây: xem file HOHUOIVANH_BANG_TINH_PHUONG_AN_CHOT.xlsx.', { size: 20 }));

const doc = new Document({
  sections: [{
    properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1134, bottom: 1134, left: 1134, right: 850 } } },
    children: body
  }]
});
const buf = await Packer.toBuffer(doc);
const out = [
  path.join(here, '../docs/mat-bang-neo-9-be/THUYET_MINH_TINH_TOAN.docx'),
  path.join(here, '../public/docs_huoi_vanh/HOHUOIVANH_THUYET_MINH_PHUONG_AN_CHOT.docx')
];
for (const f of out) fs.writeFileSync(f, buf);
console.log(JSON.stringify({ files: out.map((f) => path.basename(f)), bytes: buf.length, sections: finalDesignNote(d).length, rafts: d.rafts.length, bases: d.schedule.bases.length }));
