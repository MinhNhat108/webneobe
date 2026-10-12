import React, { useEffect, useMemo } from 'react';
import { FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  buildFinalDesign, buildFinalDesignWorkbook, finalDesignFileName, finalDesignNote, vn, FINAL_OPTION_DATE, FINAL_OPTION_TITLE
} from '../../lib/io/finalDesignWorkbook';
import * as XLSX from 'xlsx';

/** One hook so the report, the quotation and the Excel button use the same settled design. */
export function useFinalDesign() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const results = useProjectStore((s) => s.results);
  const batchResults = useProjectStore((s) => s.batchResults);
  const calculateAllRafts = useProjectStore((s) => s.calculateAllRafts);
  const costParams = useProjectStore((s) => s.costParams);
  useEffect(() => {
    if (batchResults.length === 0) calculateAllRafts();
  }, [batchResults.length, calculateAllRafts]);
  return useMemo(
    () => (batchResults.length > 0 ? buildFinalDesign(currentProject, results, batchResults, costParams) : null),
    [currentProject, results, batchResults, costParams]
  );
}

export const FinalDesignExcelButton: React.FC<{ className?: string; label?: string }> = ({ className, label = 'Tải Bảng Tính Excel (có công thức)' }) => {
  const d = useFinalDesign();
  return (
    <button
      type="button"
      disabled={!d}
      onClick={() => d && XLSX.writeFile(buildFinalDesignWorkbook(d), finalDesignFileName(d))}
      className={className ?? 'no-print px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5'}
      title="Bảng tính phương án chốt: 9 sheet kết quả và 4 sheet CT_ có công thức Excel (đổi ô NHẬP là tự tính lại)"
    >
      <FileSpreadsheet className="w-3.5 h-3.5" /> {label}
    </button>
  );
};

const th = 'px-1.5 py-1 text-right font-semibold';
const td = 'px-1.5 py-1 text-right font-mono';

/** Calculation note of the settled design (all nine rafts), for the report tab. Same text as the `ThuyetMinh` sheet. */
export const FinalDesignSection: React.FC = () => {
  const d = useFinalDesign();
  if (!d) return null;
  const note = finalDesignNote(d);
  const T = d.totals;
  return (
    <div className="print-page bg-white p-8 md:p-12 rounded-xl border border-slate-200 shadow-sm text-slate-900 space-y-5 max-w-4xl mx-auto">
      <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-brand-600 uppercase tracking-widest">Thuyết minh tính toán — phương án chốt (cả 9 bè)</div>
          <h1 className="text-lg md:text-xl font-black mt-1">{FINAL_OPTION_TITLE}</h1>
          <div className="text-xs text-slate-600 mt-1">Chủ đầu tư chốt ngày {FINAL_OPTION_DATE} · {d.name}</div>
        </div>
        <FinalDesignExcelButton />
      </div>

      <div className={`p-3 rounded-lg border text-sm font-bold flex items-center gap-2 ${T.allOk ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}>
        <CheckCircle2 className="w-5 h-5" />
        {T.allOk ? 'Mọi bè, mọi cọc bờ và mọi đế đều đạt ở gió tính toán' : 'CÓ hạng mục KHÔNG ĐẠT — xem bảng'} (V = {vn(d.wind_ms, 0)} m/s)
      </div>
      {d.windCaveat && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">⚠️ {d.windCaveat}</div>}

      {note.map((s) => (
        <div key={s.title} className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">{s.title}</h2>
          <ul className="text-xs text-slate-800 list-disc pl-5 space-y-0.5">
            {s.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      ))}

      <div className="space-y-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">Bảng A. Lực dây, cáp và cọc khoan nhồi theo bè</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border border-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-1.5 py-1 text-left">Bè</th><th className={th}>Số dây</th><th className={th}>F (kN)</th><th className={th}>T dây (kN)</th>
                <th className="px-1.5 py-1 text-left">Cáp</th><th className={th}>HSAT cáp</th><th className={th}>Số cọc</th><th className="px-1.5 py-1 text-left">Cọc D × L_tk</th>
                <th className="px-1.5 py-1 text-left">Thép chủ</th><th className={th}>BP-1 ngang</th><th className={th}>BP-2 uốn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.rafts.map((r) => (
                <tr key={r.name}>
                  <td className="px-1.5 py-1 font-bold">{r.name}</td><td className={td}>{r.lines}</td><td className={td}>{vn(r.fEnv_kN)}</td><td className={td}>{vn(r.tMax_kN)}</td>
                  <td className="px-1.5 py-1">{r.cable}</td><td className={td}>{vn(r.sfIntact, 2)}</td><td className={td}>{r.pileCount}</td>
                  <td className="px-1.5 py-1">D{Math.round(r.pileD_m * 1000)} × {vn(r.pileL_m)} m</td><td className="px-1.5 py-1">{r.cage} {r.grade}</td>
                  <td className={td}>{vn(r.bp1, 2)}</td><td className={td}>{vn(r.bp2, 2)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-1.5 py-1">TỔNG</td><td className={td}>{T.lines}</td><td colSpan={4} /><td className={td}>{T.shorePiles}</td>
                <td className="px-1.5 py-1" colSpan={4}>{vn(T.shoreLength_m)} m · {vn(T.shoreConcrete_m3)} m³ bê tông · {vn(T.shoreSteel_kg / 1000)} tấn thép</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">Bảng B. {T.bases} đế BTCT + vít xoắn</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border border-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-1.5 py-1 text-left">Đế</th><th className="px-1.5 py-1 text-left">Hai dây</th><th className={th}>B × t (m)</th><th className={th}>Bê tông (m³)</th>
                <th className={th}>T_v (kN)</th><th className={th}>Nhổ</th><th className={th}>Trượt</th><th className={th}>Lật</th><th className={th}>1 vít</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.schedule.bases.map((b) => (
                <tr key={b.baseId} className={b.ok ? '' : 'bg-rose-50'}>
                  <td className="px-1.5 py-1 font-bold">{b.baseId}</td><td className="px-1.5 py-1">{b.code}</td>
                  <td className={td}>{vn(b.side_m, 2)} × {vn(b.thickness_m, 1)}</td><td className={td}>{vn(b.concrete_m3, 2)}</td>
                  <td className={td}>{vn(Math.max(...b.combinations.map((c) => c.Tv_kN)))}</td>
                  <td className={td}>{vn(b.upliftUtil, 2)}</td><td className={td}>{vn(b.slideUtil, 2)}</td><td className={td}>{vn(b.overturnUtil, 2)}</td><td className={td}>{vn(b.screwUtil, 2)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-1.5 py-1" colSpan={3}>TỔNG: {T.bases} đế · {T.screws} vít ({vn(T.screwLength_m, 0)} m)</td><td className={td}>{vn(T.baseConcrete_m3)}</td>
                <td className={td}>{vn(T.upliftDemand_kN, 0)}</td><td className="px-1.5 py-1" colSpan={4}>Sức chống nhổ tổng {vn(T.upliftResistance_kN, 0)} kN</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          Mỗi đế có 4 vít ống Ø89×5 ren Ø105 ngàm 3 m. Các cột Nhổ, Trượt, Lật, 1 vít là mức sử dụng (≤ 1,00 là đạt). Bảng từng cọc khoan nhồi (231 cọc)
          và mọi bước tính nằm trong file Excel.
        </p>
      </div>
    </div>
  );
};
