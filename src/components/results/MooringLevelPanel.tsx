import React, { useMemo } from 'react';
import { Waves } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { calculateProject } from '../../lib/calc';
import type { ProjectState } from '../../lib/calc/types';
import { compensationText } from '../../lib/io/finalDesignWorkbook';

const vn = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '∞');

/** The ways the lines can follow the water level, compared for the active raft. */
const MODES: Array<{ label: string; levelCompensation: 'fixed' | 'seasonal'; adjustStep_m: number }> = [
  { label: 'Cáp cắt cố định', levelCompensation: 'fixed', adjustStep_m: 0 },
  { label: 'Căng chỉnh mỗi 2 m', levelCompensation: 'seasonal', adjustStep_m: 2 },
  { label: 'Căng chỉnh mỗi 1 m', levelCompensation: 'seasonal', adjustStep_m: 1 },
  { label: 'Bù liên tục', levelCompensation: 'seasonal', adjustStep_m: 0 }
];

/**
 * Hồ Bản Mòng: the line tension comes from the equilibrium of the raft on its
 * real lines at every water level (mooringEquilibrium.ts). Shows that analysis
 * for the active raft, lets the user choose how the lines follow the water and
 * compares the four ways with the raft's own cable.
 */
export const MooringLevelPanel: React.FC = () => {
  const { currentProject, results, updateLine } = useProjectStore();
  const eq = results.mooringAnalysis;
  const layout = currentProject.line.layout;
  const compare = useMemo(() => {
    if (!layout) return [];
    return MODES.map((m) => {
      const st: ProjectState = { ...currentProject, line: { ...currentProject.line, levelCompensation: m.levelCompensation, adjustStep_m: m.adjustStep_m } };
      const r = calculateProject(st);
      return { ...m, r };
    });
  }, [currentProject, layout]);
  if (!eq || !layout) return null;
  const L = currentProject.line;
  const isActive = (m: (typeof MODES)[number]) =>
    (L.levelCompensation ?? 'fixed') === m.levelCompensation && (m.levelCompensation === 'fixed' || (L.adjustStep_m ?? 0) === m.adjustStep_m);
  const limit = layout.minGap_m / 2;

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-start gap-3">
          <Waves className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="card-title">Phân tích cân bằng neo theo mực nước (hồ sâu)</h3>
            <p className="card-subtitle">
              Lực dây tính từ cân bằng tĩnh của bè trên các dây thật: 24 hướng tải × mọi mực nước từ khi bè nổi tới MNLKT; dây chùng không chịu lực, dây căng theo góc dốc thật.
              EA = {vn(L.eaPerMbl ?? 15, 0)} × lực đứt (giả định). Không xét xoay bè và tải động.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-600 font-semibold">Cách dây theo mực nước (cả dự án):</span>
          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => updateLine({ levelCompensation: m.levelCompensation, adjustStep_m: m.adjustStep_m })}
              className={`px-2.5 py-1 rounded-lg border font-semibold ${isActive(m) ? 'bg-brand-600 border-brand-500 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-slate-700">Đang tính: <strong>{compensationText(L.levelCompensation, L.adjustStep_m)}</strong>.</p>

        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">So sánh cho bè đang chọn ({L.cableCode}, lực đứt {vn(L.mbl_kN, 0)} kN)</th>
                <th className="p-2 text-right">T dây lớn nhất (kN)</th>
                <th className="p-2 text-right">Số dây căng</th>
                <th className="p-2 text-right">T khi đứt 1 dây (kN)</th>
                <th className="p-2 text-right">HSAT cáp (≥ {vn(currentProject.criteria.sfLineIntact, 1)})</th>
                <th className="p-2 text-right">Độ trôi lớn nhất (≤ {vn(limit, 2)} m)</th>
                <th className="p-2 text-center">Kết luận bè</th>
              </tr>
            </thead>
            <tbody>
              {compare.map(({ label, r, ...m }) => {
                const a = r.mooringAnalysis!;
                const sf = L.mbl_kN / r.t_max_intact_kN;
                return (
                  <tr key={label} className={`border-t border-slate-200 ${isActive({ label, ...m }) ? 'bg-brand-50 font-semibold' : ''}`}>
                    <td className="p-2">{label}</td>
                    <td className="p-2 text-right font-mono">{vn(r.t_max_intact_kN)}</td>
                    <td className="p-2 text-right font-mono">{a.governing.taut}</td>
                    <td className="p-2 text-right font-mono">{vn(r.t_max_damaged_kN)}</td>
                    <td className={`p-2 text-right font-mono ${sf < currentProject.criteria.sfLineIntact ? 'text-rose-600' : 'text-emerald-700'}`}>{vn(sf, 2)}</td>
                    <td className={`p-2 text-right font-mono ${a.maxDrift_m > limit ? 'text-rose-600' : 'text-emerald-700'}`}>{vn(a.maxDrift_m, 2)}</td>
                    <td className={`p-2 text-center ${r.overallVerdict === 'PASS' ? 'text-emerald-700' : 'text-rose-600'}`}>{r.overallVerdict === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Mực nước (m)</th>
                <th className="p-2 text-right">T lớn nhất (kN)</th>
                <th className="p-2 text-left">Dây chịu lớn nhất</th>
                <th className="p-2 text-right">Hướng tải (°)</th>
                <th className="p-2 text-right">Độ trôi lớn nhất (m)</th>
                <th className="p-2 text-right">Số dây căng ít nhất</th>
              </tr>
            </thead>
            <tbody>
              {eq.levels.map((l) => (
                <tr key={l.level_m} className={`border-t border-slate-200 ${l.level_m === eq.governing.level_m ? 'bg-amber-50 font-semibold' : ''}`}>
                  <td className="p-2 font-mono">{vn(l.level_m, 2)}</td>
                  <td className="p-2 text-right font-mono">{vn(l.maxTension_kN)}</td>
                  <td className="p-2 font-mono">{l.maxLine}</td>
                  <td className="p-2 text-right font-mono">{l.direction_deg}</td>
                  <td className="p-2 text-right font-mono">{vn(l.maxDrift_m, 2)}</td>
                  <td className="p-2 text-right font-mono">{l.minTaut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Bè chỉ phân tích từ mực nước {vn(layout.floatLevel_m, 2)} m (đáy thiết kế + mớn nước) trở lên; thấp hơn bè nằm trên đáy.
            Khe hở nhỏ nhất tới bè bên cạnh {vn(layout.minGap_m, 2)} m.
          </p>
        </div>
      </div>
    </div>
  );
};
