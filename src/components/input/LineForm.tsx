import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import pesCablesData from '../../data/pesCables.json';
import chainGradesData from '../../data/chainGrades.json';
import { estimateChainMBL_kN, estimateChainWeightAir_kgpm } from '../../lib/calc/constants';
import { calculateLoads } from '../../lib/calc/loads';
import { GitCommit, Sparkles, CheckCircle2 } from 'lucide-react';

export const LineForm: React.FC = () => {
  const { currentProject, updateLine } = useProjectStore();
  const line = currentProject.line;
  const isSolar = currentProject.systemType === 'solar_fpv';

  // SF cáp lấy từ chính tiêu chuẩn dự án (tab "Tiêu Chuẩn"), không hard-code —
  // đổi SF ở đó phải phản ánh ngay vào khối gợi ý này.
  const sfLineIntact = currentProject.criteria.sfLineIntact > 0 ? currentProject.criteria.sfLineIntact : 3.0;
  const loads = calculateLoads(currentProject.raft, currentProject.env, line, isSolar, sfLineIntact);
  const mbl = line.mbl_kN || 227;
  const tAllow = mbl / sfLineIntact;
  const pretension = line.pretension_kN || 0;
  const angleRad = ((line.horizontalAngle_deg || 30) * Math.PI) / 180;
  const cosAlpha = Math.cos(angleRad);
  const fEnv = loads.f_env_total_kN;

  // Minimum effective lines so tension <= T_allow
  const netAllow = Math.max(1, tAllow - pretension);
  const minNeff = Math.max(1, Math.ceil(fEnv / (cosAlpha * netAllow)));

  // Spacing constraint (<= 15m perimeter spacing)
  const perimeter = 2 * ((currentProject.raft.length_m || 0) + (currentProject.raft.width_m || 0));
  const minLinesBySpacing = perimeter > 0 ? Math.max(4, Math.ceil(perimeter / 15)) : 4;
  const recommendedTotal = Math.max(minLinesBySpacing, minNeff * 3);

  const currentEff = line.effectiveCount ?? 0;
  const currentTotal = line.count ?? 0;
  // "Đạt yêu cầu" means the current setup is AT LEAST the minimum needed —
  // being over-provisioned is safe, not "chưa tối ưu", so this must not
  // require an exact match (a stricter reading used to nag users into
  // trimming an already-safe configuration back down to the bare minimum).
  const isSufficient = currentEff >= minNeff && currentTotal >= recommendedTotal;
  // Only flag as "worth trimming" when comfortably over the recommendation —
  // a little slack is normal and shouldn't trigger a nudge every render.
  const isOverProvisioned = isSufficient && (currentEff > minNeff * 1.5 || currentTotal > recommendedTotal * 1.3);

  // Keep the existing shore/bed split ratio when growing (or shrinking) the
  // total line count, instead of leaving shoreLineCount+bedLineCount out of
  // sync with the new `count`.
  const distributeShoreAndBed = (total: number) => {
    const curShore = line.shoreLineCount ?? 0;
    const curBed = line.bedLineCount ?? 0;
    const curSum = curShore + curBed;
    if (curSum > 0) {
      const newShore = Math.round((total * curShore) / curSum);
      return { shoreLineCount: newShore, bedLineCount: total - newShore };
    }
    const newShore = Math.ceil(total / 2);
    return { shoreLineCount: newShore, bedLineCount: total - newShore };
  };

  const handleApplyRecommendation = () => {
    const newTotal = Math.max(currentTotal, recommendedTotal);
    const newEff = Math.max(currentEff, minNeff);
    updateLine({
      effectiveCount: newEff,
      count: newTotal,
      ...distributeShoreAndBed(newTotal)
    });
  };

  const handleTrimToMinimum = () => {
    updateLine({
      effectiveCount: minNeff,
      count: recommendedTotal,
      ...distributeShoreAndBed(recommendedTotal)
    });
  };

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

      {/* Smart Mooring Line Recommendation based on current Wind Load */}
      <div className="bg-gradient-to-r from-sky-50 via-indigo-50/40 to-emerald-50/50 p-4 rounded-xl border border-sky-200/80 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sky-900 font-semibold text-xs">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>GỢI Ý SỐ DÂY NEO THEO TẢI TRỌNG GIÓ HIỆN TẠI (V = {currentProject.env.windSpeed_ms} m/s, F_env = {fEnv.toFixed(1)} kN):</span>
          </div>
          {isSufficient ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đạt yêu cầu theo gió hiện tại
            </span>
          ) : (
            <button
              type="button"
              onClick={handleApplyRecommendation}
              className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Áp Dụng Gợi Ý (N_eff ≥ {minNeff}, Tổng ≥ {recommendedTotal})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          • Với tải trọng môi trường <strong>{fEnv.toFixed(1)} kN</strong> và độ bền cáp <strong>{line.cableCode || 'PES'} ({mbl} kN)</strong>: Cần tối thiểu <strong>{minNeff} dây chịu lực chính (N_eff)</strong> để đạt hệ số an toàn SF ≥ {sfLineIntact.toFixed(1)}.
          <br />
          • Theo chu vi bè {perimeter > 0 ? `${perimeter} m` : ''} (khoảng cách ≤ 15m/dây): Đề xuất tổng bố trí tối thiểu <strong>{recommendedTotal} dây neo</strong> quanh bè.
        </p>
        {isOverProvisioned && (
          <p className="text-[11px] text-slate-500 border-t border-sky-200/60 pt-2">
            Cấu hình hiện tại (N_eff = {currentEff}, tổng {currentTotal} dây) đang dư khá nhiều so với mức cần thiết ở gió này.{' '}
            <button
              type="button"
              onClick={handleTrimToMinimum}
              className="text-sky-700 underline underline-offset-2 hover:text-sky-900 font-medium"
            >
              Tối giản về N_eff = {minNeff}, tổng {recommendedTotal} dây
            </button>
          </p>
        )}
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
          helpText="Số dây chịu lực chính đón hướng gió (vd: 4-6 dây)"
        />
      </div>
    </div>
  );
};
