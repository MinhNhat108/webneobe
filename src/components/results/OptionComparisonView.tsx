import React, { useMemo } from 'react';
import { Scale, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../data/huoiVanhProject';
import { compareMooringOptions } from '../../lib/calc/technicalComparison';
import { DEADWEIGHT_DEFAULTS, DeadweightParams } from '../../lib/calc/deadweight';
import type { ProjectState } from '../../lib/calc/types';

const DEFAULT_ANCHOR = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;

const num = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '∞';
const rng = (r: [number, number], d: number) => (r[0] === r[1] ? num(r[0], d) : `${num(r[0], d)} ÷ ${num(r[1], d)}`);

/** The comparison every screen shows — one hook so the tab, the report and the 3D view agree. */
export function useOptionComparison() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeRaftId = useProjectStore((s) => s.activeRaftId);
  const raftsSummary = useProjectStore((s) => s.raftsSummary);
  return useMemo(
    () => compareMooringOptions(currentProject, activeRaftId, raftsSummary, DEFAULT_ANCHOR),
    [currentProject, activeRaftId, raftsSummary]
  );
}

const PARAM_FIELDS: Array<{ key: keyof DeadweightParams; label: string; unit: string; step: number }> = [
  { key: 'mu', label: 'Hệ số ma sát khối – bùn đáy μ', unit: '', step: 0.05 },
  { key: 'sfSlide', label: 'SF chống trượt yêu cầu', unit: '', step: 0.1 },
  { key: 'sfUplift', label: 'SF chống nhấc bổng yêu cầu', unit: '', step: 0.1 },
  { key: 'sfOverturn', label: 'SF chống lật yêu cầu', unit: '', step: 0.1 },
  { key: 'qAllow_kPa', label: 'Sức chịu tải cho phép nền bùn q_allow', unit: 'kPa', step: 5 },
  { key: 'rhoConcrete_tm3', label: 'Khối lượng riêng bê tông ρ_c', unit: 't/m³', step: 0.05 }
];

const RISKS: Array<{ criterion: string; pa1: string; pa2: string }> = [
  {
    criterion: 'Giữ bè khi gió bão',
    pa1: 'Sức kháng ngang và nhổ do đất quanh cọc (Broms), kiểm tra BP-3..BP-5 tại L_tk.',
    pa2: 'Chỉ dựa vào ma sát đáy khối với bùn (μ giả định). Lực nhổ V làm giảm ma sát, nên hệ số an toàn giảm nhanh khi cáp dốc hoặc gió giật vượt thiết kế.'
  },
  {
    criterion: 'Chuyển vị chân neo',
    pa1: 'Cọc ngàm trong đất: chuyển vị đầu cọc nhỏ, đàn hồi.',
    pa2: 'Khi vượt ngưỡng ma sát khối trượt và không tự trở về; dịch chuyển tích lũy qua nhiều trận gió làm chùng / lệch tuyến cáp.'
  },
  {
    criterion: 'Lún / chìm trong bùn đáy hồ',
    pa1: 'Mũi cọc ngàm vào lớp đất bên dưới, ít phụ thuộc lớp bùn mặt.',
    pa2: 'DW-4 chỉ so áp lực tiếp xúc với q_allow giả định. Lún cố kết và nghiêng khối theo thời gian chưa được tính; cần khảo sát địa chất đáy hồ.'
  },
  {
    criterion: 'Chiếm chỗ ở khe hẹp giữa các bè',
    pa1: 'Tiết diện cọc dưới 0,4 m² mỗi điểm.',
    pa2: 'Đáy khối hàng chục m² mỗi điểm; ở các khe bè hẹp (< 35 m) các khối đặt trên cùng tim khe nằm sát nhau.'
  },
  {
    criterion: 'Thi công trên hồ',
    pa1: 'Sà lan và búa đóng cọc; trọng lượng một cọc vài tấn.',
    pa2: 'Phải cẩu và thả chính xác các khối hàng chục đến hơn trăm tấn xuống đáy hồ.'
  },
  {
    criterion: 'Nghiệm thu',
    pa1: 'Có quy trình thử tải cọc (nén / nhổ / ngang) theo TCVN.',
    pa2: 'Không có thử tải tương đương; phải kiểm chứng μ bằng thí nghiệm kéo khối tại hiện trường.'
  }
];

const Row: React.FC<{ label: string; a: React.ReactNode; b: React.ReactNode }> = ({ label, a, b }) => (
  <tr>
    <td className="px-3 py-2 font-semibold text-slate-800">{label}</td>
    <td className="px-3 py-2 text-slate-700">{a}</td>
    <td className="px-3 py-2 text-slate-700">{b}</td>
  </tr>
);

export const OptionComparisonView: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const cmp = useOptionComparison();
  const updateDeadweightParams = useProjectStore((s) => s.updateDeadweightParams);
  const option = useProjectStore((s) => s.currentProject.anchor.bedAnchorOption) ?? 'PA1_PILE';
  const p = cmp.params;
  const hasTrial = cmp.rows.some((r) => r.isTrial);
  const widened = cmp.rows.filter((r) => r.block.bearingGovernsShape).map((r) => r.name);
  const sfCls = (v: number, req: number) => (v >= req ? 'text-emerald-700' : 'text-rose-600 font-bold');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5 text-xs">
      <div className="flex items-start gap-3">
        <Scale className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            So Sánh Kỹ Thuật Hai Phương Án Neo Đáy Hồ: PA1 (Cọc Đóng BTCT) & PA2 (Khối Bê Tông Neo Đáy)
          </h2>
          <p className="text-slate-500 mt-0.5">
            {cmp.shoreCount} cọc bờ giống nhau ở cả hai phương án (bờ dốc, không đặt được khối). Khác nhau ở {cmp.bedCount} điểm
            neo đáy hồ. Cả hai tính từ cùng lực căng thiết kế T_max và góc cáp đáy của từng bè. Đang chọn:{' '}
            <strong>{option === 'PA2_DEADWEIGHT' ? 'Phương án 2' : 'Phương án 1'}</strong>.
          </p>
        </div>
      </div>

      {hasTrial && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          ⚠️ Bè đang chọn dùng thông số thử nghiệm ở Tab 2 (khác thiết kế chốt), nên bảng này tính theo thông số đó.
        </div>
      )}
      {!cmp.allBlocksOk && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900 font-semibold">
          ❌ Không định cỡ được khối đạt cả 4 điều kiện cho: {cmp.failingRafts.join(', ')} (xem bảng bên dưới).
        </div>
      )}

      {/* PA2 engineering inputs */}
      {!compact && (
        <div className="no-print">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">Thông số kỹ thuật đầu vào của khối bê tông (PA2)</h3>
            <button
              type="button"
              onClick={() => updateDeadweightParams(DEADWEIGHT_DEFAULTS)}
              className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Đặt lại mặc định
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PARAM_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-600">{f.label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    step={f.step}
                    min={0}
                    value={p[f.key]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const valid = Number.isFinite(v) && v > 0 && (f.key !== 'rhoConcrete_tm3' || v > 1);
                      if (valid) updateDeadweightParams({ [f.key]: v });
                    }}
                    className="w-20 text-right font-mono border border-slate-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-slate-400 w-9">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      {compact && (
        <p className="text-slate-600">
          Thông số khối bê tông: μ = {p.mu}; SF trượt ≥ {p.sfSlide}; SF nhấc bổng ≥ {p.sfUplift}; SF lật ≥ {p.sfOverturn}; q_allow ={' '}
          {p.qAllow_kPa} kPa; ρ_c = {p.rhoConcrete_tm3} t/m³.
        </p>
      )}

      {/* Head to head */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left w-1/4">Thông số ({cmp.bedCount} điểm neo đáy hồ)</th>
              <th className="px-3 py-2 text-left">PA1 — cọc đóng BTCT</th>
              <th className="px-3 py-2 text-left">PA2 — khối bê tông neo đáy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <Row
              label="Cơ chế làm việc"
              a="Cọc ngàm trong đất: chịu lực ngang và nhổ qua tương tác đất – cọc (Broms)."
              b="Khối tựa trên bùn: chịu lực qua ma sát đáy và trọng lượng bản thân trong nước."
            />
            <Row
              label="Kiểm tra áp dụng"
              a="BP-3 (ngang), BP-4 (nhổ), BP-5 (uốn)"
              b="DW-1 (trượt), DW-2 (nhấc bổng), DW-3 (lật), DW-4 (áp lực nền bùn)"
            />
            <Row
              label="Tổng thể tích bê tông neo đáy"
              a={<span className="font-mono">{num(cmp.pa1BedConcrete_m3, 0)} m³</span>}
              b={<span className="font-mono">{num(cmp.pa2BedConcrete_m3, 0)} m³ (gấp {num(cmp.concreteRatio, 1)} lần)</span>}
            />
            <Row
              label="Kích thước một điểm neo"
              a={<span className="font-mono">cạnh cọc {rng(cmp.bedPileSide_m, 2)} m</span>}
              b={<span className="font-mono">đáy {rng(cmp.blockSide_m, 2)} m, cao {rng(cmp.blockHeight_m, 2)} m</span>}
            />
            <Row
              label="Trọng lượng một điểm neo"
              a={<span className="font-mono">{rng(cmp.bedPileMass_t, 1)} tấn / cọc</span>}
              b={<span className="font-mono">{rng(cmp.blockMass_t, 1)} tấn / khối</span>}
            />
            <Row
              label="Diện tích đáy hồ bị chiếm"
              a={<span className="font-mono">{num(cmp.pa1BedFootprint_m2, 1)} m² (dưới 0,4 m² / điểm)</span>}
              b={<span className="font-mono">{num(cmp.pa2BedFootprint_m2, 0)} m² ({rng(cmp.blockBaseArea_m2, 1)} m² / điểm)</span>}
            />
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div>
            Chống trượt quyết định khối lượng khối; khối được định cỡ để đạt DW-1…DW-4 tại gió thiết kế, nên các hệ số an toàn nằm sát
            ngưỡng yêu cầu.
            {widened.length > 0 && <> Đáy khối phải mở rộng (khối dẹt hơn L = 1,4·H) để áp lực nền không vượt q_allow ở: {widened.join(', ')}.</>}
          </div>
          <div>μ và q_allow là giá trị giả định cho đến khi có khảo sát địa chất đáy hồ. Lún của khối trong bùn chưa được tính.</div>
        </div>
      </div>

      {/* Per raft */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left">Bè</th>
              <th className="px-2 py-2 text-right">Neo đáy</th>
              <th className="px-2 py-2 text-right">T_max (kN)</th>
              <th className="px-2 py-2 text-right">Góc cáp (°)</th>
              <th className="px-2 py-2 text-right">H / V (kN)</th>
              <th className="px-2 py-2 text-right">PA1: cọc a × L (m)</th>
              <th className="px-2 py-2 text-right">η cọc</th>
              <th className="px-2 py-2 text-right">PA2: L × W × H (m)</th>
              <th className="px-2 py-2 text-right">W_air (T)</th>
              <th className="px-2 py-2 text-right">W_sub (kN)</th>
              <th className="px-2 py-2 text-right">SF trượt</th>
              <th className="px-2 py-2 text-right">SF nhấc</th>
              <th className="px-2 py-2 text-right">SF lật</th>
              <th className="px-2 py-2 text-right">q (kPa)</th>
              <th className="px-2 py-2 text-center">KL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {cmp.rows.map((r) => (
              <tr key={r.name}>
                <td className="px-2 py-1.5 font-sans font-bold text-slate-900">{r.name}{r.isTrial ? ' ⚠️' : ''}</td>
                <td className="px-2 py-1.5 text-right">{r.bedCount}</td>
                <td className="px-2 py-1.5 text-right">{num(r.tension_kN, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.bedCableAngle_deg, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.block.H_kN, 1)} / {num(r.block.V_kN, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.bedPile.side_m, 2)} × {num(r.bedPile.length_m, 1)}</td>
                <td className={`px-2 py-1.5 text-right ${r.bedPileUtil !== null && r.bedPileUtil > 1 ? 'text-rose-600 font-bold' : ''}`}>
                  {r.bedPileUtil === null ? '—' : num(r.bedPileUtil, 2)}
                </td>
                <td className="px-2 py-1.5 text-right">{num(r.block.L_m, 2)} × {num(r.block.W_m, 2)} × {num(r.block.H_m, 2)}</td>
                <td className="px-2 py-1.5 text-right font-bold">{num(r.block.mass_t, 1)}</td>
                <td className="px-2 py-1.5 text-right">{num(r.block.weightSub_kN, 0)}</td>
                <td className={`px-2 py-1.5 text-right ${sfCls(r.block.sfSlide, p.sfSlide)}`}>{num(r.block.sfSlide, 2)}</td>
                <td className={`px-2 py-1.5 text-right ${sfCls(r.block.sfUplift, p.sfUplift)}`}>{num(r.block.sfUplift, 2)}</td>
                <td className={`px-2 py-1.5 text-right ${sfCls(r.block.sfOverturn, p.sfOverturn)}`}>{num(r.block.sfOverturn, 2)}</td>
                <td className={`px-2 py-1.5 text-right ${r.block.qContact_kPa <= p.qAllow_kPa ? 'text-emerald-700' : 'text-rose-600 font-bold'}`}>
                  {num(r.block.qContact_kPa, 1)}
                </td>
                <td className="px-2 py-1.5 text-center font-sans font-bold">{r.block.ok ? 'ĐẠT' : 'K.ĐẠT'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-slate-500 mt-1">
          H = T·cos α, V = T·sin α. W_sub = W_air·(1 − 1/ρ_c). DW-1: μ·(W_sub − V)/H. DW-2: W_sub/V. DW-3: (W_sub − V)·(L/2)/(H·h), cáp
          buộc tâm mặt trên khối. DW-4: q = max(W_sub/A khi nước lặng; áp lực mép khi chịu tải). η cọc = hệ số sử dụng Broms lớn nhất của
          cọc đáy PA1. Chiều dài cọc gồm L_tk và đoạn nhô. Khối lượng khối làm tròn lên 0,5 T, kích thước làm tròn lên 0,05 m.
        </p>
      </div>

      {/* Risk matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left w-1/5">Rủi ro địa chất & thủy công</th>
              <th className="px-3 py-2 text-left">PA1 — cọc đóng BTCT</th>
              <th className="px-3 py-2 text-left">PA2 — khối bê tông neo đáy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RISKS.map((r) => <Row key={r.criterion} label={r.criterion} a={r.pa1} b={r.pa2} />)}
          </tbody>
        </table>
        <p className="text-slate-500 mt-1">Bảng rủi ro là đánh giá định tính, không phải kết quả tính toán.</p>
      </div>
    </div>
  );
};
