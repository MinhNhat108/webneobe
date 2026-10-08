import React, { useMemo } from 'react';
import { Anchor } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../data/huoiVanhProject';
import { summariseScrewBases } from '../../lib/calc/screwBaseSummary';
import { SCREW_BASE_DEFAULTS, ScrewBaseParams } from '../../lib/calc/screwAnchorBed';
import type { ProjectState } from '../../lib/calc/types';
import { designWindCaveat } from '../../lib/calc/designWind';

const DEFAULT_ANCHOR = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;
const num = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '∞';

type NumericKey = Exclude<keyof ScrewBaseParams, 'autoSize'>;
const FIELDS: Array<{ key: NumericKey; label: string; unit: string; step: number }> = [
  { key: 'side_m', label: 'Cạnh đế B (nhỏ nhất khi tự định cỡ)', unit: 'm', step: 0.25 },
  { key: 'thickness_m', label: 'Chiều dày đế t (nhỏ nhất)', unit: 'm', step: 0.1 },
  { key: 'cuSurface_kPa', label: 'c_u bùn mặt, ngay dưới đáy đế', unit: 'kPa', step: 1 },
  { key: 'cuAverage_kPa', label: 'c_u trung bình dọc thân vít', unit: 'kPa', step: 1 },
  { key: 'screwCount', label: 'Số vít xoắn', unit: 'cây', step: 4 },
  { key: 'screwLength_m', label: 'Chiều dài vít ngập trong bùn L', unit: 'm', step: 0.5 },
  { key: 'alphaBase', label: 'Hệ số bám dính đáy đế α', unit: '', step: 0.1 },
  { key: 'alphaShaft', label: 'Hệ số bám dính thân vít α', unit: '', step: 0.1 },
  { key: 'skirtDepth_m', label: 'Chiều sâu gờ chống trượt', unit: 'm', step: 0.05 },
  { key: 'sfSlide', label: 'FS chống trượt', unit: '', step: 0.1 },
  { key: 'sfOverturn', label: 'FS chống lật', unit: '', step: 0.1 },
  { key: 'sfScrewUplift', label: 'FS nhổ vít', unit: '', step: 0.1 }
];

/** One hook so Tab 9, the report and the quotation show the same bases. */
export function useScrewBaseSummary() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeRaftId = useProjectStore((s) => s.activeRaftId);
  const raftsSummary = useProjectStore((s) => s.raftsSummary);
  return useMemo(
    () => summariseScrewBases(currentProject, activeRaftId, raftsSummary, DEFAULT_ANCHOR),
    [currentProject, activeRaftId, raftsSummary]
  );
}

/** Design of the lake-bed anchors as RC bases with screw piles: inputs, the base of every raft, totals and warnings. */
export const ScrewBasePanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const s = useScrewBaseSummary();
  const anchor = useProjectStore((st) => st.currentProject.anchor);
  const update = useProjectStore((st) => st.updateScrewBaseParams);
  const updateAnchor = useProjectStore((st) => st.updateAnchor);
  const selected = (anchor.bedAnchorOption ?? 'PA1_PILE') === 'PA3_SCREW_BASE';
  const windCaveat = designWindCaveat(useProjectStore((st) => st.currentProject.env.windSpeed_ms));
  // c_u follows the project's lake-bed mud unless it is overridden here.
  const p: ScrewBaseParams = {
    ...SCREW_BASE_DEFAULTS,
    cuSurface_kPa: anchor.cuBed_kPa ?? SCREW_BASE_DEFAULTS.cuSurface_kPa,
    cuAverage_kPa: anchor.cuBed_kPa ?? SCREW_BASE_DEFAULTS.cuAverage_kPa,
    ...(anchor.screwBase ?? {})
  };
  const u = (v: number) => <span className={v <= 1 ? 'text-emerald-700' : 'text-rose-600 font-bold'}>{num(v, 2)}</span>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
      <div className="flex items-start gap-3">
        <Anchor className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">Neo Đáy Hồ: Đế BTCT + Vít Xoắn {selected ? '(phương án đang chọn)' : ''}</h2>
          <p className="text-slate-500 mt-0.5">
            Tính theo sheet <strong>6.DE_NEO_VIT</strong> trong bảng tính của Chủ đầu tư: chống nhổ, trượt, lật, lực nhổ một vít, áp lực nền và thép bản đế,
            ở hai mực nước (thấp: dây thoải, trượt lớn nhất; cao: dây dốc, nhổ lớn nhất). Mỗi bè một cỡ đế, tính với tuyến cáp đáy ngắn nhất của bè.
          </p>
        </div>
      </div>

      {windCaveat && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-amber-900 font-semibold">⚠️ {windCaveat}</div>
      )}
      {!s.allOk && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900 font-semibold">
          ❌ Không có đế nào (đến 8 × 8 m) đạt cho: {s.failingRafts.join(', ')}. Xem bảng bên dưới; cần tăng số / chiều dài vít hoặc khảo sát lại c_u.
        </div>
      )}
      {s.enlargedRafts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          ⚠️ Đế mẫu {num(p.side_m, 2)} × {num(p.side_m, 2)} × {num(p.thickness_m, 2)} m chỉ đạt với lực dây khoảng 70 kN. Các bè {s.enlargedRafts.join(', ')} có lực dây
          lớn hơn nên đế đã được tăng lên (đến {num(s.side_m[1], 2)} m, nặng {num(s.maxLiftMass_t, 1)} tấn khi cẩu). Với các bè lớn, sức giữ chủ yếu đến từ bám dính đáy đế
          (α·c_u·B²), 4 vít chỉ góp một phần nhỏ.
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
        c_u bùn, γ′ và các hệ số bám dính là <strong>giả định</strong>, chưa có khảo sát đáy hồ. Bùn mặt lòng hồ thường chỉ 2–10 kPa: với c_u thấp hơn
        20 kPa mọi đế sẽ phải lớn hơn. Chưa thiết kế: tai neo cáp, khóa đầu vít, móc cẩu, chống ăn mòn vít.
      </div>

      {!compact && (
        <div className="no-print">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">Thông số đầu vào của đế và vít (áp dụng cho mọi bè)</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-slate-700">
                <input type="checkbox" checked={p.autoSize} onChange={(e) => update({ autoSize: e.target.checked })} />
                Tự tăng kích thước đế cho đến khi đạt
              </label>
              <button type="button" onClick={() => updateAnchor({ screwBase: undefined })} className="text-brand-600 hover:text-brand-700 underline">
                Về mặc định
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-slate-600">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                <input
                  type="number"
                  step={f.step}
                  min={0}
                  value={p[f.key]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) update({ [f.key]: v } as Partial<ScrewBaseParams>);
                  }}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-slate-900"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900 leading-relaxed">
        <strong>{s.bases} đế cho {s.lines} tuyến cáp đáy, trong đó {s.sharedBases} đế DÙNG CHUNG</strong> (hai dây của hai bè đối diện neo vào một đế đặt ở tim khe, đế có hai tai neo).
        Đế dùng chung được kiểm tra với một dây căng cực đại + dây kia ở lực căng trước, và với cả hai dây cùng căng (lực ngang triệt tiêu, lực nhổ cộng lại) — nên đế dùng chung không nhỏ hơn đế đơn; cái tiết kiệm được là SỐ đế.
        Số đế theo cạnh: {Object.entries(s.basesBySide).map(([side, n]) => `${n} đế ${side.replace('.', ',')} m`).join('; ')}. Đế nặng nhất khi cẩu {num(s.maxLiftMass_t, 1)} tấn.
        Mỗi đế dùng chung tính một nửa cho mỗi bè. Tai neo đôi chưa được thiết kế.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              {['Bè', 'Dây đáy (dùng chung)', 'Số đế tính cho bè', 'T dây (kN)', 'Dây ngắn nhất (m)', 'Cạnh đế từng điểm (m)', 'Bê tông (m³)', 'Đế kiểm tra theo bè', 'Nhổ', 'Trượt', 'Lật', 'Một vít', 'Nền', 'Kết luận'].map((h) => (
                <th key={h} className="px-2 py-1.5 border-b border-slate-200 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {s.rows.map((r) => (
              <tr key={r.name} className="border-b border-slate-100">
                <td className="px-2 py-1 font-sans font-semibold">{r.name}{r.isTrial ? ' ⚠️' : ''}</td>
                <td className="px-2 py-1">{r.bedCount} ({r.sharedLines})</td>
                <td className="px-2 py-1">{num(r.bases, 1)}</td>
                <td className="px-2 py-1">{num(r.tension_kN, 1)}</td>
                <td className="px-2 py-1">{num(r.base.load.span_m, 1)}</td>
                <td className="px-2 py-1">{r.side_m[0] === r.side_m[1] ? num(r.side_m[0], 2) : `${num(r.side_m[0], 2)} – ${num(r.side_m[1], 2)}`}</td>
                <td className="px-2 py-1">{num(r.concrete_m3, 1)}</td>
                <td className="px-2 py-1">{num(r.base.side_m, 2)} × {num(r.base.side_m, 2)} × {num(r.base.thickness_m, 2)}{r.base.enlarged ? ' ↑' : ''}</td>
                <td className="px-2 py-1">{u(r.base.upliftUtil)}</td>
                <td className="px-2 py-1">{u(r.base.slideUtil)}</td>
                <td className="px-2 py-1">{u(r.base.overturnUtil)}</td>
                <td className="px-2 py-1">{u(r.base.screwUtil)}</td>
                <td className="px-2 py-1">{u(r.base.bearingUtil)}</td>
                <td className={`px-2 py-1 font-sans font-bold ${r.base.ok && r.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{r.base.ok && r.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-2 py-1.5">Tổng</td>
              <td className="px-2 py-1.5 font-mono">{s.lines}</td>
              <td className="px-2 py-1.5 font-mono">{s.bases}</td>
              <td className="px-2 py-1.5" colSpan={3}>{num(s.screws)} vít xoắn, {num(s.screwLength_m)} m</td>
              <td className="px-2 py-1.5 font-mono">{num(s.concrete_m3, 1)}</td>
              <td className="px-2 py-1.5" colSpan={7}>Thép bản đế khoảng {num(s.rebar_kg / 1000, 1)} tấn. Các cột Nhổ … Nền là hệ số sử dụng (≤ 1,00 là đạt) của đế kiểm tra theo bè. ↑ = đế đã tăng so với đế mẫu.</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
