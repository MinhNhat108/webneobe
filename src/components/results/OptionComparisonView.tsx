import React, { useMemo } from 'react';
import { Scale, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../data/huoiVanhProject';
import { compareMooringOptions, CostInputs, DEFAULT_COST_INPUTS, CostBreakdown } from '../../lib/calc/optionComparison';
import type { ProjectState } from '../../lib/calc/types';

const DEFAULT_ANCHOR = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;

const ty = (vnd: number) => `${(vnd / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tỷ`;
const num = (v: number, d = 0) => v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });

/** The comparison every screen shows — one hook so the tab, the report and the 3D view agree. */
export function useOptionComparison() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeRaftId = useProjectStore((s) => s.activeRaftId);
  const raftsSummary = useProjectStore((s) => s.raftsSummary);
  const costInputs = useProjectStore((s) => s.costInputs);
  return useMemo(
    () => compareMooringOptions(currentProject, activeRaftId, raftsSummary, DEFAULT_ANCHOR, costInputs),
    [currentProject, activeRaftId, raftsSummary, costInputs]
  );
}

const PRICE_FIELDS: Array<{ key: keyof CostInputs; label: string; unit: string; step: number }> = [
  { key: 'concrete_vnd_m3', label: 'Bê tông B25 (vật liệu + đổ đúc)', unit: 'đ/m³', step: 50_000 },
  { key: 'steel_vnd_kg', label: 'Cốt thép', unit: 'đ/kg', step: 500 },
  { key: 'formwork_vnd_m2', label: 'Ván khuôn', unit: 'đ/m²', step: 10_000 },
  { key: 'pileSteel_kg_m3', label: 'Hàm lượng thép cọc (PA1)', unit: 'kg/m³', step: 5 },
  { key: 'blockSteel_kg_m3', label: 'Hàm lượng thép khối (PA2)', unit: 'kg/m³', step: 5 },
  { key: 'pileDriving_vnd', label: 'Đóng 1 cọc (sà lan + búa)', unit: 'đ/cọc', step: 100_000 },
  { key: 'blockLift_vnd', label: 'Cẩu thả 1 khối (1 lần cẩu)', unit: 'đ/lần', step: 500_000 },
  { key: 'craneCapacity_t', label: 'Sức nâng cẩu nổi', unit: 'tấn', step: 5 },
  { key: 'mu', label: 'Hệ số ma sát khối – bùn μ', unit: '', step: 0.05 },
  { key: 'sfSlide', label: 'SF chống trượt', unit: '', step: 0.1 },
  { key: 'sfUplift', label: 'SF chống nhấc bổng', unit: '', step: 0.1 }
];

const RISKS: Array<{ criterion: string; pa1: string; pa2: string }> = [
  {
    criterion: 'Giữ bè khi gió bão',
    pa1: 'Sức kháng ngang và nhổ do đất quanh cọc (Broms), kiểm tra BP-1..BP-5 tại L_tk.',
    pa2: 'Chỉ dựa vào ma sát đáy khối với bùn (μ giả định). Khối trượt là bè trôi; hệ số an toàn giảm nhanh khi cáp dốc vì lực nhổ làm giảm ma sát.'
  },
  {
    criterion: 'Lún / chìm trong bùn đáy hồ',
    pa1: 'Mũi cọc ngàm vào lớp đất bên dưới, ít phụ thuộc lớp bùn mặt.',
    pa2: 'Khối hàng chục đến hơn trăm tấn đặt trên bùn: lún và nghiêng chưa được tính trong công cụ này, cần khảo sát địa chất đáy hồ.'
  },
  {
    criterion: 'Chiếm chỗ ở khe hẹp giữa các bè',
    pa1: 'Tiết diện cọc 0,35–0,60 m.',
    pa2: 'Mặt bằng khối vài mét mỗi cạnh; ở các khe bè hẹp (< 35 m) nhiều khối nằm sát nhau trên cùng tim khe.'
  },
  {
    criterion: 'Thiết bị thi công trên hồ',
    pa1: 'Sà lan + búa đóng cọc thông dụng.',
    pa2: 'Cần cẩu nổi sức nâng lớn; khối nặng hơn sức nâng phải chia nhỏ và liên kết lại dưới nước (chưa tính chi phí liên kết).'
  },
  {
    criterion: 'Độ bền 25 năm',
    pa1: 'Cọc BTCT ngàm trong đất, lớp bảo vệ cốt thép theo TCVN.',
    pa2: 'Khối bê tông ít cốt thép, bền; rủi ro chính là dịch chuyển tích lũy sau nhiều trận gió.'
  },
  {
    criterion: 'Nghiệm thu',
    pa1: 'Có quy trình thử tải cọc (nén / nhổ / ngang) theo TCVN.',
    pa2: 'Không có thử tải tương đương cho khối trọng lực; phải kiểm chứng μ bằng thí nghiệm kéo tại hiện trường.'
  }
];

const QtyRow: React.FC<{ label: string; a: string; b: string; strong?: boolean }> = ({ label, a, b, strong }) => (
  <tr className={strong ? 'bg-slate-50 font-bold' : ''}>
    <td className="px-3 py-2 text-slate-700">{label}</td>
    <td className="px-3 py-2 text-right font-mono">{a}</td>
    <td className="px-3 py-2 text-right font-mono">{b}</td>
  </tr>
);

const bedRow = (label: string, f: (c: CostBreakdown) => string, a: CostBreakdown, b: CostBreakdown) => (
  <QtyRow key={label} label={label} a={f(a)} b={f(b)} />
);

export const OptionComparisonView: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const cmp = useOptionComparison();
  const costInputs = useProjectStore((s) => s.costInputs);
  const updateCostInputs = useProjectStore((s) => s.updateCostInputs);
  const maxTotal = Math.max(cmp.pa1Total_vnd, cmp.pa2Total_vnd, 1);
  const cheaperLabel = cmp.cheaper === 'PA1_PILE' ? 'PA1 (cọc đóng)' : cmp.cheaper === 'PA2_DEADWEIGHT' ? 'PA2 (khối bê tông)' : '—';
  const hasTrial = cmp.rows.some((r) => r.isTrial);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5 text-xs">
      <div className="flex items-start gap-3">
        <Scale className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">So sánh phương án neo đáy hồ: PA1 cọc đóng BTCT và PA2 khối bê tông trọng lực</h2>
          <p className="text-slate-500 mt-0.5">
            {cmp.shoreCount} cọc bờ giống nhau ở cả hai phương án (bờ dốc, không đặt được khối). Khác nhau ở {cmp.bedCount} điểm
            neo đáy hồ. Khối lượng tính từ cùng lực căng thiết kế T_max và góc cáp đáy của từng bè.
          </p>
        </div>
      </div>

      {hasTrial && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          ⚠️ Bè đang chọn dùng thông số thử nghiệm ở Tab 2 (khác thiết kế chốt), nên bảng này tính theo thông số đó.
        </div>
      )}

      {/* Totals */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { name: 'PA1 — Cọc đóng BTCT', v: cmp.pa1Total_vnd, cls: 'bg-emerald-500' },
          { name: 'PA2 — Khối bê tông neo đáy', v: cmp.pa2Total_vnd, cls: 'bg-amber-500' }
        ].map((o) => (
          <div key={o.name} className="border border-slate-200 rounded-xl p-3">
            <div className="text-slate-500">{o.name}</div>
            <div className="font-mono text-lg font-bold text-slate-900">{ty(o.v)}</div>
            <div className="h-2 rounded bg-slate-100 mt-2 overflow-hidden">
              <div className={`h-full ${o.cls}`} style={{ width: `${(o.v / maxTotal) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="border border-brand-200 bg-brand-50/60 rounded-xl p-3">
          <div className="text-slate-500">Chênh lệch (PA2 − PA1)</div>
          <div className="font-mono text-lg font-bold text-brand-900">{ty(Math.abs(cmp.delta_vnd))}</div>
          <div className="text-brand-800 mt-1">
            Rẻ hơn: <strong>{cheaperLabel}</strong>
            {cmp.pa1Total_vnd > 0 && cmp.cheaper !== 'EQUAL' && (
              <> · PA2 bằng {num(cmp.pa2Total_vnd / cmp.pa1Total_vnd, 1)} lần PA1</>
            )}
          </div>
        </div>
      </div>

      {/* Head to head */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200 rounded-lg">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Hạng mục ({cmp.bedCount} điểm neo đáy hồ)</th>
              <th className="px-3 py-2 text-right">PA1 — cọc đáy</th>
              <th className="px-3 py-2 text-right">PA2 — khối bê tông</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bedRow('Bê tông (m³)', (c) => num(c.concrete_m3, 0), cmp.pa1Bed, cmp.pa2Bed)}
            {bedRow('Cốt thép (tấn)', (c) => num(c.steel_t, 1), cmp.pa1Bed, cmp.pa2Bed)}
            {bedRow('Ván khuôn (m²)', (c) => num(c.formwork_m2, 0), cmp.pa1Bed, cmp.pa2Bed)}
            {bedRow('Vật tư & đúc sẵn', (c) => ty(c.material_vnd), cmp.pa1Bed, cmp.pa2Bed)}
            <QtyRow
              label="Thi công trên mặt nước"
              a={`${ty(cmp.pa1Bed.installation_vnd)} (${cmp.bedCount} cọc)`}
              b={`${ty(cmp.pa2Bed.installation_vnd)} (${cmp.totalLifts} lần cẩu)`}
            />
            {bedRow('Cộng phần neo đáy hồ', (c) => ty(c.total_vnd), cmp.pa1Bed, cmp.pa2Bed)}
            <QtyRow label={`${cmp.shoreCount} cọc bờ (chung cho cả hai)`} a={ty(cmp.shorePiles.total_vnd)} b={ty(cmp.shorePiles.total_vnd)} />
            <QtyRow label="TỔNG CỘNG phần neo" a={ty(cmp.pa1Total_vnd)} b={ty(cmp.pa2Total_vnd)} strong />
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div>
            Khối bê tông tính được nặng <strong>{num(cmp.blockMassMin_t, 1)}–{num(cmp.blockMassMax_t, 1)} tấn</strong> mỗi điểm neo
            (chống trượt chi phối). {cmp.blocksOverCrane > 0 && (
              <>
                <strong>{cmp.blocksOverCrane}/{cmp.bedCount}</strong> điểm vượt sức nâng cẩu {costInputs.craneCapacity_t} T, nên chi phí
                thi công tính theo số lần cẩu sau khi chia khối ({cmp.totalLifts} lần); chưa gồm chi phí liên kết các khối dưới nước.
              </>
            )}
          </div>
          <div>
            Đơn giá là <strong>giả định tham khảo, chưa phải định mức hay báo giá</strong> — sửa ở bảng bên dưới. Hàm lượng thép cọc PA1
            cũng là giả định: cốt thép cọc chưa được thiết kế theo TCVN 5574:2018 trong công cụ này.
          </div>
        </div>
      </div>

      {/* Per raft */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left">Bè</th>
              <th className="px-2 py-2 text-right">Điểm neo đáy</th>
              <th className="px-2 py-2 text-right">T_max (kN)</th>
              <th className="px-2 py-2 text-right">Góc cáp (°)</th>
              <th className="px-2 py-2 text-right">PA1: cọc a × L (m)</th>
              <th className="px-2 py-2 text-right">PA2: khối L × W × H (m)</th>
              <th className="px-2 py-2 text-right">W (tấn)</th>
              <th className="px-2 py-2 text-right">SF trượt</th>
              <th className="px-2 py-2 text-right">SF nhấc</th>
              <th className="px-2 py-2 text-right">Lần cẩu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {cmp.rows.map((r) => (
              <tr key={r.name}>
                <td className="px-2 py-1.5 font-sans font-bold text-slate-900">{r.name}{r.isTrial ? ' ⚠️' : ''}</td>
                <td className="px-2 py-1.5 text-right">{r.bedCount}</td>
                <td className="px-2 py-1.5 text-right">{num(r.tension_kN, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.bedCableAngle_deg, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.bedPile.side_m, 2)} × {num(r.bedPile.length_m, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.block.L_m, 2)} × {num(r.block.W_m, 2)} × {num(r.block.H_m, 2)}</td>
                <td className="px-2 py-1.5 text-right font-bold">{num(r.block.mass_t, 1)}</td>
                <td className={`px-2 py-1.5 text-right ${r.block.sfSlide >= costInputs.sfSlide ? 'text-emerald-700' : 'text-rose-600 font-bold'}`}>{num(r.block.sfSlide, 2)}</td>
                <td className={`px-2 py-1.5 text-right ${r.block.sfUplift >= costInputs.sfUplift ? 'text-emerald-700' : 'text-rose-600 font-bold'}`}>{num(r.block.sfUplift, 2)}</td>
                <td className="px-2 py-1.5 text-right">{r.liftsPerBlock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-slate-500 mt-1">
          W_sub = W·(1 − 1/2,4) = 0,583·W. Nhấc bổng: W_sub ≥ SF·V. Trượt: μ·(W_sub − V) ≥ SF·H, với H = T·cos α, V = T·sin α. Chiều dài
          cọc PA1 gồm L_tk và đoạn nhô. Khối hộp L = W ≈ 1,4·H, kích thước làm tròn lên 0,05 m.
        </p>
      </div>

      {/* Risk matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left w-1/5">Tiêu chí kỹ thuật</th>
              <th className="px-3 py-2 text-left">PA1 — cọc đóng BTCT</th>
              <th className="px-3 py-2 text-left">PA2 — khối bê tông neo đáy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RISKS.map((r) => (
              <tr key={r.criterion}>
                <td className="px-3 py-2 font-semibold text-slate-800">{r.criterion}</td>
                <td className="px-3 py-2 text-slate-700">{r.pa1}</td>
                <td className="px-3 py-2 text-slate-700">{r.pa2}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-slate-500 mt-1">Bảng rủi ro là đánh giá định tính, không phải kết quả tính toán.</p>
      </div>

      {/* Editable assumptions */}
      {!compact && (
        <div className="no-print border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">Giả định đơn giá và thông số PA2 (sửa được)</h3>
            <button
              type="button"
              onClick={() => updateCostInputs(DEFAULT_COST_INPUTS)}
              className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Đặt lại mặc định
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PRICE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-600">{f.label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    step={f.step}
                    min={0}
                    value={costInputs[f.key]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v > 0) updateCostInputs({ [f.key]: v });
                    }}
                    className="w-28 text-right font-mono border border-slate-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-slate-400 w-10">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
