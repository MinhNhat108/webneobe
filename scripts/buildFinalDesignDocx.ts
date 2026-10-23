/**
 * Writes the calculation note of the settled design (bored shore piles D350 +
 * RC bases with screw piles) as a Word file, from the same builder as the web
 * note and the calculation workbook (`finalDesignWorkbook.ts`).
 *
 *   npx vite-node scripts/buildFinalDesignDocx.ts
 *   npx vite-node scripts/buildFinalDesignDocx.ts -- --lake=ban-mong
 *
 * Output (Huổi Vanh): docs/mat-bang-neo-9-be/THUYET_MINH_TINH_TOAN.docx and the web
 * attachment public/docs_huoi_vanh/HOHUOIVANH_THUYET_MINH_PHUONG_AN_CHOT.docx;
 * (Bản Mòng): docs/mat-bang-neo-ban-mong/ and public/docs_ban_mong/HOBANMONG_THUYET_MINH_TINH_TOAN.docx.
 */
import './selectLake';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlignmentType, Document, HeadingLevel, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildFinalDesign, finalDesignNote, vn, FINAL_OPTION_DATE, FINAL_OPTION_TITLE } from '../src/lib/io/finalDesignWorkbook';
import { ACTIVE_LAKE_ID } from '../src/data/lakes';

const HV = ACTIVE_LAKE_ID === 'huoi-vanh';

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
// Vietnamese text: no English proofing (Word would underline every word in red), and symbols such as c_u, T_0,
// M_max written with a real subscript.
const LANG = { value: 'vi-VN' };
// one- or two-letter symbol + index only, so file names with underscores are left alone
const SUB = /(?<![\p{L}\d_])([\p{L}]{1,2})_([\p{L}]+|\d+)(?![\p{L}\d_])/gu;
const runs = (text: string, opt: { bold?: boolean; size?: number } = {}): TextRun[] => {
  const base = { font: FONT, size: opt.size ?? 24, bold: opt.bold, noProof: true, language: LANG };
  const out: TextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(SUB)) {
    out.push(new TextRun({ ...base, text: text.slice(last, m.index) + m[1] }));
    out.push(new TextRun({ ...base, text: m[2], subScript: true }));
    last = m.index! + m[0].length;
  }
  out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out;
};
const para = (text: string, opt: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
  new Paragraph({ children: runs(text, opt), alignment: opt.align, spacing: { after: opt.after ?? 80 } });
const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 100 }, children: runs(text, { bold: true, size: 26 }) });
const bullet = (text: string) => new Paragraph({ children: runs(text), bullet: { level: 0 }, spacing: { after: 60 } });
const table = (head: string[], rows: Array<Array<string | number>>) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [head, ...rows].map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c) => new TableCell({ children: [new Paragraph({ children: runs(String(c), { size: 18, bold: i === 0 }), alignment: AlignmentType.CENTER })] }))
    }))
  });

const body: Array<Paragraph | Table> = [
  para('THUYẾT MINH TÍNH TOÁN HỆ NEO BÈ', { bold: true, size: 32, align: AlignmentType.CENTER }),
  para(d.name, { bold: true, size: 26, align: AlignmentType.CENTER }),
  para(HV ? `Phương án chốt: ${FINAL_OPTION_TITLE}` : `Phương án neo: ${FINAL_OPTION_TITLE} (áp dụng tạm phương án chốt của Huổi Vanh, CHƯA chốt cho hồ này)`, { align: AlignmentType.CENTER }),
  para(HV ? `Chủ đầu tư chốt ngày ${FINAL_OPTION_DATE} · Mã hồ sơ ${d.code}` : `HỒ SƠ ĐỂ XEM XÉT — chưa dùng để đặt hàng, thi công · Mã hồ sơ ${d.code}`, { align: AlignmentType.CENTER, after: 240 })
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
body.push(para(`Bảng từng cọc khoan nhồi (${T.shorePiles} cọc), từng bước tính của mỗi đế và chiều dài cắt ${T.lines} dây: xem file ${HV ? 'HOHUOIVANH_BANG_TINH_PHUONG_AN_CHOT.xlsx' : 'HOBANMONG_BANG_TINH_NEO.xlsx'}.`, { size: 20 }));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, language: LANG } } } },
  sections: [{
    properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1134, bottom: 1134, left: 1134, right: 850 } } },
    children: body
  }]
});
const buf = await Packer.toBuffer(doc);
const out = HV
  ? [path.join(here, '../docs/mat-bang-neo-9-be/THUYET_MINH_TINH_TOAN.docx'), path.join(here, '../public/docs_huoi_vanh/HOHUOIVANH_THUYET_MINH_PHUONG_AN_CHOT.docx')]
  : [path.join(here, `../docs/mat-bang-neo-${ACTIVE_LAKE_ID}/THUYET_MINH_TINH_TOAN.docx`), path.join(here, '../public/docs_ban_mong/HOBANMONG_THUYET_MINH_TINH_TOAN.docx')];
fs.mkdirSync(path.dirname(out[0]), { recursive: true });
for (const f of out) fs.writeFileSync(f, buf);
console.log(JSON.stringify({ files: out.map((f) => path.basename(f)), bytes: buf.length, sections: finalDesignNote(d).length, rafts: d.rafts.length, bases: d.schedule.bases.length }));
