import React from 'react';
import { CalcResults, PileOptimizationResult, ProjectState } from '../../lib/calc/types';
import { Calculator, Zap, ShieldAlert, Cpu, Ruler, Gauge } from 'lucide-react';

const GOVERNING_LABEL: Record<string, string> = {
  lateral: 'Sức chịu tải ngang',
  uplift: 'Sức chịu nhổ',
  moment: 'Bền uốn tiết diện',
  none: '—'
};

const fmtCapacity = (v: number) => (Number.isFinite(v) ? `${v} kN` : 'Không chi phối');

/** L_opt / P_max summary for one pile family (shore or lake bed). */
const PileOptimizationCard: React.FC<{ title: string; opt?: PileOptimizationResult }> = ({ title, opt }) => {
  if (!opt) return null;
  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
      <div className="font-sans font-bold text-amber-900 border-b border-slate-100 pb-1 flex items-center justify-between gap-2">
        <span>{title}</span>
        <span
          className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${
            opt.converged ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {opt.converged ? `Chi phối: ${GOVERNING_LABEL[opt.governing]}` : 'Không hội tụ'}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-600 font-sans">Chiều sâu ngàm tối ưu (L_opt):</span>
        <span className="font-bold text-emerald-700">
          {opt.L_opt_m !== null ? `${opt.L_opt_m} m` : '—'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 font-sans">Khoảng tìm kiếm / bước làm tròn:</span>
        <span>{opt.minL_m}–{opt.maxL_m} m / {opt.step_m} m</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 font-sans">P_max theo sức chịu tải ngang:</span>
        <span>{fmtCapacity(opt.capacity.Pmax_lateral_kN)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 font-sans">P_max theo bền uốn tiết diện:</span>
        <span>{fmtCapacity(opt.capacity.Pmax_moment_kN)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 font-sans">P_max theo sức chịu nhổ:</span>
        <span>{fmtCapacity(opt.capacity.Pmax_uplift_kN)}</span>
      </div>
      {opt.ratedPmax_kN !== undefined && (
        <div className="flex justify-between">
          <span className="text-slate-600 font-sans">P_max định mức (catalog/thí nghiệm):</span>
          <span>{opt.ratedPmax_kN} kN</span>
        </div>
      )}
      <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
        <span className="text-amber-900 font-sans font-bold">P_req / P_max:</span>
        <span className={`font-bold text-sm ${opt.isPmaxOk ? 'text-emerald-700' : 'text-rose-700'}`}>
          {opt.Preq_kN} / {opt.effectivePmax_kN} kN ({(opt.utilization_Pmax * 100).toFixed(1)}%)
        </span>
      </div>
      {opt.note && <p className="text-[11px] text-rose-700 font-sans leading-relaxed">{opt.note}</p>}
    </div>
  );
};

interface IntermediateTableProps {
  state: ProjectState;
  results: CalcResults;
}

export const IntermediateTable: React.FC<IntermediateTableProps> = ({ state, results }) => {
  const isSolar = state.systemType === 'solar_fpv';
  const raft = state.raft;
  const env = state.env;

  // Geometry calculations for 4 sides
  const waterDepth = env.waterDepth_m || 6.0;
  const bankSlope = env.bankSlope_m || 3.1;
  const shoreOffset = ((env.mncn_m || 384) - (env.mndbt_m || 383) + 0.5) * bankSlope;

  // South side
  const southSpan = (raft.southDist_m || 17.1) + shoreOffset;
  const southLength = Math.sqrt(southSpan * southSpan + 1.5 * 1.5);

  // North side
  const northSpan = (raft.northDist_m || 33.2) + shoreOffset;
  const northLength = Math.sqrt(northSpan * northSpan + 1.5 * 1.5);

  // East side
  const eastSpan = (raft.eastDist_m || 44.2) + shoreOffset;
  const eastLength = Math.sqrt(eastSpan * eastSpan + 1.5 * 1.5);

  // West side (Lake bed pile)
  const westBedDist = (raft.westDist_m || 27.0) / 2.0;
  const westAngleDeg = results.bedCableAngle_deg !== undefined
    ? results.bedCableAngle_deg
    : (Math.atan(waterDepth / Math.max(1, westBedDist)) * 180) / Math.PI;
  const westLength = Math.sqrt(westBedDist * westBedDist + waterDepth * waterDepth);

  // Approximate line counts per edge (based on 20 total lines: 6 South, 6 North, 4 East, 4 West)
  const southCount = Math.round(state.line.count * 0.3) || 6;
  const northCount = Math.round(state.line.count * 0.3) || 6;
  const eastCount = Math.round(state.line.count * 0.2) || 4;
  const westCount = state.line.count - southCount - northCount - eastCount || 4;

  const totalCableLength =
    southCount * southLength +
    northCount * northLength +
    eastCount * eastLength +
    westCount * westLength;

  return (
    <div className="card p-6 space-y-6">
      <div className="form-card-header">
        <div className="form-card-icon bg-brand-50 text-brand-600">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h3 className="card-title">
            Kết Quả Tính Toán Trung Gian & Công Thức Chi Tiết
          </h3>
          <p className="card-subtitle">
            Thuyết minh các bước tính lực môi trường, sức căng cáp, phản lực cọc và chiều dài cáp 4 cạnh bè
          </p>
        </div>
      </div>

      {/* 4-Edge Cable Distance & Length Breakdown Box */}
      {isSolar && (
        <div className="border border-sky-200 rounded-xl p-4 space-y-3 bg-sky-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900 uppercase tracking-wide">
              <Ruler className="w-4 h-4 text-sky-600" />
              Tổng Hợp Chi Tiết Khoảng Cách & Chiều Dài Cáp 4 Cạnh Bè
            </div>
            <span className="text-xs font-bold text-sky-800 font-mono">
              Tổng mét cáp đặt hàng: ~{Math.round(totalCableLength)} m
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            {/* South */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs space-y-1">
              <div className="font-sans font-bold text-slate-800 flex justify-between">
                <span>Cạnh dài Nam (Bờ):</span>
                <span className="text-brand-600">{raft.southDist_m} m</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Khoảng cách tới cọc:</span>
                <span>{southSpan.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-1">
                <span className="font-sans">Dài 1 dây / Tổng:</span>
                <span>{southLength.toFixed(1)}m x {southCount} = {Math.round(southLength * southCount)}m</span>
              </div>
            </div>

            {/* North */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs space-y-1">
              <div className="font-sans font-bold text-slate-800 flex justify-between">
                <span>Cạnh dài Bắc (Bờ):</span>
                <span className="text-brand-600">{raft.northDist_m} m</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Khoảng cách tới cọc:</span>
                <span>{northSpan.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-1">
                <span className="font-sans">Dài 1 dây / Tổng:</span>
                <span>{northLength.toFixed(1)}m x {northCount} = {Math.round(northLength * northCount)}m</span>
              </div>
            </div>

            {/* East */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-2xs space-y-1">
              <div className="font-sans font-bold text-slate-800 flex justify-between">
                <span>Cạnh ngắn Đông (Bờ):</span>
                <span className="text-brand-600">{raft.eastDist_m} m</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Khoảng cách tới cọc:</span>
                <span>{eastSpan.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-1">
                <span className="font-sans">Dài 1 dây / Tổng:</span>
                <span>{eastLength.toFixed(1)}m x {eastCount} = {Math.round(eastLength * eastCount)}m</span>
              </div>
            </div>

            {/* West */}
            <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 shadow-2xs space-y-1">
              <div className="font-sans font-bold text-amber-900 flex justify-between">
                <span>Cạnh Tây (Cọc đáy):</span>
                <span className="text-amber-700">{raft.westDist_m} m</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Cự ly tới cọc (d/2):</span>
                <span>{westBedDist.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between text-amber-900 font-bold">
                <span className="font-sans">Góc nghiêng cáp (θ):</span>
                <span>{westAngleDeg.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between text-amber-950 font-bold border-t border-amber-200 pt-1">
                <span className="font-sans">Dài 1 dây / Tổng:</span>
                <span>{westLength.toFixed(1)}m x {westCount} = {Math.round(westLength * westCount)}m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Environmental Loads Box */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <Zap className="w-4 h-4 text-amber-500" />
            1. Tải trọng môi trường tác dụng lên hệ bè (F_env)
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Áp lực gió động (q):</span>
              <span className="font-bold text-slate-900">{results.q_wind_Pa.toLocaleString()} Pa</span>
            </div>

            {isSolar && results.f_wind_panel_kN !== undefined && (
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-600 font-sans">Lực gió trên mặt tấm pin (F_pin):</span>
                <span className="font-bold text-slate-900">{results.f_wind_panel_kN} kN</span>
              </div>
            )}

            {isSolar && results.f_wind_float_kN !== undefined && (
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-600 font-sans">Lực gió trên hệ phao nổi (F_phao):</span>
                <span className="font-bold text-slate-900">{results.f_wind_float_kN} kN</span>
              </div>
            )}

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Tổng lực gió tác dụng (F_wind):</span>
              <span className="font-bold text-slate-900">{results.f_wind_total_kN} kN</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Lực dòng chảy (F_current):</span>
              <span className="font-bold text-slate-900">{results.f_current_kN} kN</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Lực sóng trôi dạt (F_wave):</span>
              <span className="font-bold text-slate-900">{results.f_wave_kN} kN</span>
            </div>

            {isSolar && (
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-600 font-sans">Chế độ tổ hợp tải:</span>
                <span className="font-bold text-slate-700 text-[11px]">
                  {(env.loadCombinationMode ?? 'fpv_combined') === 'separate' ? 'Tính riêng biệt' : `Gộp hệ số ${env.waveCurrentFactor ?? 1.05}`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-2 bg-sky-50 rounded-lg border border-sky-200">
              <span className="text-sky-900 font-sans font-bold">Tổng lực môi trường F_env:</span>
              <span className="font-bold text-sky-900 text-sm">{results.f_env_total_kN} kN</span>
            </div>
          </div>
        </div>

        {/* 2. Line Tension Box */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            2. Phân bố lực căng dây neo & Sức đứt MBL
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Hệ số tập trung lực (k_focus):</span>
              <span className="font-bold text-slate-900">{state.line.focusFactor}</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Lực căng dây lớn nhất T_max (Nguyên vẹn):</span>
              <span className="font-bold text-emerald-600">{results.t_max_intact_kN} kN</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Lực căng dây khi đứt 1 dây (Damaged):</span>
              <span className="font-bold text-slate-900">{results.t_max_damaged_kN} kN</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Sức đứt MBL yêu cầu (FS = 3.0):</span>
              <span className="font-bold text-slate-900">{results.mbl_required_kN} kN</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-600 font-sans">Cáp đã chọn & MBL thực tế:</span>
              <span className="font-bold text-slate-900">{state.line.cableCode || 'Cáp'} ({state.line.mbl_kN} kN)</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-emerald-900 font-sans font-bold">Hệ số sử dụng cáp (Utilization):</span>
              <span className="font-bold text-emerald-900 text-sm">{results.cableUtilization !== null ? `${(results.cableUtilization * 100).toFixed(1)}%` : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Broms Piles Intermediate Output */}
      {results.shorePile && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <Cpu className="w-4 h-4 text-indigo-600" />
            3. Tính toán khả năng chịu lực Cọc Neo (Phương pháp Broms)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Shore Pile Summary */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-sans font-bold text-indigo-900 border-b border-slate-100 pb-1 flex items-center justify-between">
                <span>Cọc Neo BỜ ({results.shorePile.shape === 'circular' ? 'Tròn' : results.shorePile.shape === 'pipe' ? 'Ống' : 'Vuông'} {state.anchor.shoreD_m}m, Ngàm {state.anchor.shoreL_m}m)</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {results.shorePile.soilModel === 'sand' ? 'Đất rời (Broms φ)' : 'Đất dính (Broms cu)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">
                  {results.shorePile.soilModel === 'sand' ? 'Góc ma sát trong (φ):' : 'Lực dính đất bờ (cu):'}
                </span>
                <span>
                  {results.shorePile.soilModel === 'sand'
                    ? `${state.anchor.phiShore_deg ?? 30}° (Kp=${results.shorePile.Kp})`
                    : `${state.anchor.cuShore_kPa} kPa`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">Sức chịu ngang cực hạn (Hu):</span>
                <span className="font-bold text-slate-900">{results.shorePile.Hu} kN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">Sức chịu ngang cho phép (H_allow, FS=2.5):</span>
                <span className="font-bold text-emerald-600">{results.shorePile.H_allow} kN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">Mômen uốn lớn nhất (M_max):</span>
                <span>{results.shorePile.Mmax} kNm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">
                  Mômen giới hạn tiết diện (M_rd{(results.shorePile.MrdSteel_kNm ?? 0) > 0 ? ' = bê tông + thép' : ''}):
                </span>
                <span>
                  {results.shorePile.Mrd} kNm
                  {(results.shorePile.MrdSteel_kNm ?? 0) > 0 && (
                    <span className="text-slate-400"> ({results.shorePile.MrdConcrete_kNm} + {results.shorePile.MrdSteel_kNm})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans">Chiều dài cọc đặt hàng:</span>
                <span className="font-bold">{results.shorePile.orderedLength_m} m</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <span className="text-slate-600 font-sans">Thể tích bê tông 1 cọc bờ:</span>
                <span className="font-bold text-indigo-700">{results.shorePile.concreteVolume_m3} m³</span>
              </div>
            </div>

            {/* Lake Bed Pile Summary */}
            {results.bedPile1 && (
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="font-sans font-bold text-indigo-900 border-b border-slate-100 pb-1 flex items-center justify-between">
                  <span>Cọc Neo ĐÁY LÒNG HỒ ({state.anchor.bed1D_m}m, Ngàm {state.anchor.bed1L_m}m)</span>
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {results.bedPile1.soilModel === 'sand' ? 'Đất rời (Broms φ)' : 'Đất dính (Broms cu)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">
                    {results.bedPile1.soilModel === 'sand' ? 'Góc ma sát trong (φ):' : 'Lực dính bùn đáy (cu):'}
                  </span>
                  <span>
                    {results.bedPile1.soilModel === 'sand'
                      ? `${state.anchor.phiBed_deg ?? 30}° (Kp=${results.bedPile1.Kp})`
                      : `${state.anchor.cuBed_kPa} kPa`}
                  </span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold">
                  <span className="text-slate-600 font-sans">Góc nghiêng cáp tại đỉnh cọc:</span>
                  <span>{results.bedCableAngle_deg}°</span>
                </div>
                <div className="flex justify-between text-amber-900 font-bold">
                  <span className="text-slate-600 font-sans">Lực kéo ngang (Th) / Lực nhổ (Tv):</span>
                  <span>{results.bedCableTh_kN} kN / {results.bedCableTv_kN} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Sức chịu ngang cho phép (H_allow):</span>
                  <span className="font-bold text-emerald-600">{results.bedPile1.H_allow} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Sức chịu nhổ cho phép (Tv_allow):</span>
                  <span className="font-bold text-emerald-600">{results.bedPile1.upliftCapacity_all} kN</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-600 font-sans">Thể tích bê tông 1 cọc lòng hồ:</span>
                  <span className="font-bold text-indigo-700">{results.bedPile1.concreteVolume_m3} m³</span>
                </div>
              </div>
            )}
          </div>

          {/* 3b. Broms inverse solve — L_opt & P_max ---------------------- */}
          {(results.shorePileOpt || results.bedPileOpt) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide pt-1">
                <Gauge className="w-4 h-4 text-amber-600" />
                Tối ưu chiều sâu đóng cọc (L_opt) & Sức chịu tải cho phép (P_max)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <PileOptimizationCard title="Cọc Neo BỜ" opt={results.shorePileOpt} />
                <PileOptimizationCard title="Cọc Neo ĐÁY LÒNG HỒ" opt={results.bedPileOpt} />
              </div>
              <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                L_opt là chiều sâu ngàm nhỏ nhất (đã làm tròn lên theo bước thi công) thỏa mãn đồng thời
                H_allow ≥ H, Q_nhổ ≥ Tv và M_max ≤ M_rd. P_max là lực căng dây lớn nhất cọc chịu được tại
                chiều sâu đó — kết quả tính toán chỉ mang tính tham khảo thiết kế, cần đối chiếu thí nghiệm
                nén–kéo cọc tại hiện trường.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Catenary Parameters (if applicable) */}
      {results.catenaryApplies && results.suspendedLength_s_m !== null && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            4. Thông số hình học Catenary & Chiều dài dây nằm đáy
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2 bg-white rounded border border-slate-100">
              <div className="text-slate-500 font-sans text-[11px]">Chiều dài lơ lửng s:</div>
              <div className="font-bold text-slate-900">{results.suspendedLength_s_m} m</div>
            </div>
            <div className="p-2 bg-white rounded border border-slate-100">
              <div className="text-slate-500 font-sans text-[11px]">Hình chiếu nằm ngang x:</div>
              <div className="font-bold text-slate-900">{results.suspendedProjection_m} m</div>
            </div>
            <div className="p-2 bg-white rounded border border-slate-100">
              <div className="text-slate-500 font-sans text-[11px]">Dây nằm tiếp đáy:</div>
              <div className="font-bold text-emerald-600">{results.groundedLength_m} m</div>
            </div>
            <div className="p-2 bg-white rounded border border-slate-100">
              <div className="text-slate-500 font-sans text-[11px]">Ma sát đáy F_fric:</div>
              <div className="font-bold text-slate-900">{results.frictionResistance_kN} kN</div>
            </div>
          </div>
        </div>
      )}

      {/* C8 / C9 geometry */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          5. Kiểm tra hình học bố trí (C8 khoảng hở đáy hồ · C9 khoảng cách dây neo)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-2 bg-white rounded border border-slate-100 flex items-center justify-between">
            <span className="text-slate-500 font-sans text-[11px]">Khoảng hở đáy bè – đáy hồ (C8):</span>
            <span className="font-bold text-slate-900">
              {results.bedClearance_m !== null ? `${results.bedClearance_m} m` : '—'}
            </span>
          </div>
          <div className="p-2 bg-white rounded border border-slate-100 flex items-center justify-between">
            <span className="text-slate-500 font-sans text-[11px]">Khoảng cách dây neo trung bình (C9):</span>
            <span className="font-bold text-slate-900">
              {results.avgLineSpacing_m !== null ? `${results.avgLineSpacing_m} m` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
