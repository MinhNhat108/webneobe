import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import pesCablesData from '../../data/pesCables.json';
import chainGradesData from '../../data/chainGrades.json';
import { estimateChainMBL_kN, estimateChainWeightAir_kgpm } from '../../lib/calc/constants';
import { GitCommit } from 'lucide-react';

export const LineForm: React.FC = () => {
  const { currentProject, updateLine } = useProjectStore();
  const line = currentProject.line;

  const handleCableSelect = (code: string) => {
    const cable = pesCablesData.find(c => c.id === code);
    if (cable) {
      updateLine({
        cableCode: code,
        type: 'cable',
        mbl_kN: cable.mbl_kN,
        unitWeightAir_kgpm: cable.weight_kgpm
      });
    }
  };

  const handleChainChange = (diameter_mm: number, grade: 'U1' | 'U2' | 'U3') => {
    const mbl = estimateChainMBL_kN(diameter_mm, grade);
    const weight = estimateChainWeightAir_kgpm(diameter_mm);
    updateLine({
      chainDiameter_mm: diameter_mm,
      chainGrade: grade,
      mbl_kN: mbl,
      unitWeightAir_kgpm: weight
    });
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-emerald-50 text-emerald-600">
            <GitCommit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              3. Hệ Thống Dây Neo & Cáp Chịu Lực
            </h3>
            <p className="card-subtitle">
              Quy cách cáp Polyester PES / Xích neo, tải trọng đứt MBL, phân bố và lực căng trước
            </p>
          </div>
        </div>

        {/* Cable Type Toggle */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => updateLine({ type: 'cable' })}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              line.type === 'cable'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cáp Polyester (PES)
          </button>
          <button
            type="button"
            onClick={() => updateLine({ type: 'chain' })}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              line.type === 'chain'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Xích Neo (Chain)
          </button>
        </div>
      </div>

      {/* Cable / Chain Catalogue Selector */}
      {line.type === 'cable' ? (
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
              Bảng tra catalogue cáp Polyester chuyên dụng cho bè nổi:
            </span>
            <span className="text-xs text-emerald-700">
              Đang chọn: <strong>{line.cableCode || 'PES-28'}</strong> (MBL: {line.mbl_kN} kN)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {pesCablesData.map((c) => {
              const isSelected = line.cableCode === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCableSelect(c.id)}
                  className={`px-3 py-2 rounded-lg border text-xs text-center transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-sm'
                      : 'border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  <div className="font-semibold">{c.id}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {c.mbl_kN} kN
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Cấp xích neo (Stud-link Chain) & Đường kính:
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-slate-700">Cấp thép xích neo</label>
              <select
                value={line.chainGrade}
                onChange={(e) => handleChainChange(line.chainDiameter_mm || 28, e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:border-brand-500 outline-none"
              >
                {chainGradesData.map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {g.name} — {g.description}
                  </option>
                ))}
              </select>
            </div>

            <NumberField
              label="Đường kính xích neo (d)"
              value={line.chainDiameter_mm}
              onChange={(val) => handleChainChange(val, line.chainGrade as any)}
              unit="mm"
              step={2}
              min={8}
            />
          </div>
        </div>
      )}

      {/* Main Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NumberField
          label="Tải trọng đứt danh định (MBL)"
          value={line.mbl_kN}
          onChange={(val) => updateLine({ mbl_kN: val })}
          unit="kN"
          step={5}
          min={10}
          helpText="Minimum Breaking Load của dây neo"
        />

        <NumberField
          label="Lực căng trước (Pre-tension T0)"
          value={line.pretension_kN}
          onChange={(val) => updateLine({ pretension_kN: val })}
          unit="kN"
          step={1}
          min={0}
          helpText="Lực căng đặt trước khi lắp đặt (5 kN)"
        />

        <NumberField
          label="Hệ số tập trung lực (k_focus)"
          value={line.focusFactor}
          onChange={(val) => updateLine({ focusFactor: val })}
          unit="-"
          step={0.01}
          min={0.05}
          max={1.0}
          helpText="T_max = F_env * k_focus + T0 (vd: 0.276)"
        />

        <NumberField
          label="Chiều dài 1 dây neo (L_total)"
          value={line.totalLength_m}
          onChange={(val) => updateLine({ totalLength_m: val })}
          unit="m"
          step={1}
          min={5}
          helpText="Tổng chiều dài đoạn dây tự do"
        />
      </div>

      {/* Line Counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <NumberField
          label="Tổng số dây neo quanh bè"
          value={line.count}
          onChange={(val) => updateLine({ count: Math.round(val) })}
          unit="dây"
          step={1}
          min={1}
        />

        <NumberField
          label="Số dây neo BỜ (Shore)"
          value={line.shoreLineCount}
          onChange={(val) => updateLine({ shoreLineCount: Math.round(val) })}
          unit="dây"
          step={1}
          min={0}
        />

        <NumberField
          label="Số dây neo ĐÁY LÒNG HỒ (Bed)"
          value={line.bedLineCount}
          onChange={(val) => updateLine({ bedLineCount: Math.round(val) })}
          unit="dây"
          step={1}
          min={0}
        />

        <NumberField
          label="Số dây cùng chịu tải chính (N_eff)"
          value={line.effectiveCount}
          onChange={(val) => updateLine({ effectiveCount: Math.round(val) })}
          unit="dây"
          step={1}
          min={1}
          helpText="Dùng cho tính toán Catenary (vd: 6 dây)"
        />
      </div>
    </div>
  );
};
