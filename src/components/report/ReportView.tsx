import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Printer, CheckCircle2, XCircle } from 'lucide-react';
import { OptionComparisonView } from '../results/OptionComparisonView';

export const ReportView: React.FC = () => {
  const { currentProject, results, raftsSummary, setActiveRaft } = useProjectStore();
  const meta = currentProject.meta;
  const isSolar = currentProject.systemType === 'solar_fpv';
  const activeRaft = raftsSummary.find(r => r.id === currentProject.activeRaftId) || raftsSummary[0];
  const raftName = activeRaft ? activeRaft.name : (currentProject.activeRaftId ? `BÈ ${currentProject.activeRaftId}` : 'BÈ 1');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print action toolbar (hidden on print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Xem Trước & In Báo Cáo Kỹ Thuật (Khổ A4)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
              Đang xem: {raftName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Báo cáo thuyết minh tính toán chi tiết cho riêng cụm bè đang chọn
          </p>
        </div>

        <div className="flex items-center gap-3">
          {raftsSummary.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Chọn cụm bè:</span>
              <select
                value={currentProject.activeRaftId || 1}
                onChange={(e) => setActiveRaft(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs shadow-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {raftsSummary.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.area_m2.toLocaleString()} m²)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            In Báo Cáo ({raftName}) / Xuất PDF
          </button>
        </div>
      </div>

      {/* Printable Report Document */}
      <div className="print-page bg-white p-8 md:p-12 rounded-xl border border-slate-200 shadow-sm text-slate-900 font-sans space-y-6 max-w-4xl mx-auto">
        {/* Report Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-brand-600 uppercase tracking-widest flex items-center gap-2">
              <span>BÁO CÁO THUYẾT MINH TÍNH TOÁN KỸ THUẬT HỆ NEO</span>
              <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-black text-[11px]">
                {raftName}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
              {meta.name || currentProject.name} — {raftName}
            </h1>
            <div className="text-xs text-slate-600 mt-1">
              Hệ thống: Hệ Bè Pin Mặt Trời Nổi (FPV) · Cụm tính toán: <strong>{raftName}</strong> (Diện tích: {activeRaft?.area_m2 ? `${activeRaft.area_m2.toLocaleString()} m²` : `${(currentProject.raft.length_m * currentProject.raft.width_m).toLocaleString()} m²`})
            </div>
          </div>

          <div className="text-right text-xs font-mono space-y-0.5 shrink-0">
            <div>Ký hiệu bè: <strong className="text-brand-700 text-sm">{raftName}</strong></div>
            <div>Mã số: <strong>{meta.code || currentProject.code}-{raftName.replace(/\s+/g, '')}</strong></div>
            <div>Ngày lập: <strong>{meta.date}</strong></div>
            <div>Địa điểm: <strong>{meta.location}</strong></div>
          </div>
        </div>

        {/* Overall Verdict Banner in Print */}
        <div
          className={`p-3 rounded-lg border flex items-center justify-between ${
            results.overallVerdict === 'PASS'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {results.overallVerdict === 'PASS' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>KẾT LUẬN TOÀN DIỆN: {results.overallVerdict === 'PASS' ? 'HỆ THỐNG ĐẠT YÊU CẦU' : 'KHÔNG ĐẠT'}</span>
          </div>

          {results.governingCheck && (
            <div className="text-xs">
              Hạng mục chi phối: <strong>{results.governingCheck.label}</strong> (Độ an toàn dư: {((results.governingCheck.margin || 0) * 100).toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Section 1: Parameters */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
            1. Bảng Thông Số Thiết Kế Đầu Vào — {raftName}
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="font-bold text-slate-800 font-sans mb-1">Hình học Bè & Tải Trọng ({raftName}):</div>
              <div>- Kích thước: {currentProject.raft.length_m}m x {currentProject.raft.width_m}m (S = {(currentProject.raft.length_m * currentProject.raft.width_m).toLocaleString()} m²)</div>
              <div>- Mớn nước: {currentProject.raft.draft_m}m | Chiều cao nổi: {currentProject.raft.freeboardHeight_m}m</div>
              {isSolar && (
                <div>- Số tấm pin: {currentProject.raft.solarPanelCount} tấm (Góc nghiêng {currentProject.raft.solarTilt_deg}°)</div>
              )}
              <div>- Vận tốc gió thiết kế: {currentProject.env.windSpeed_ms} m/s (q = {results.q_wind_Pa} Pa)</div>
              <div>- Độ sâu hồ: {currentProject.env.waterDepth_m}m | Dao động: {currentProject.env.tideRange_m}m</div>
            </div>

            <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="font-bold text-slate-800 font-sans mb-1">Quy cách Dây Neo & Cọc/Mỏ Neo ({raftName}):</div>
              <div>- Số lượng dây neo: {currentProject.line.count} dây (Cùng chịu tải: {currentProject.line.effectiveCount} dây)</div>
              <div>- Loại cáp: {currentProject.line.cableCode || 'Polyester'} | MBL = {currentProject.line.mbl_kN} kN</div>
              <div>- Lực căng trước: {currentProject.line.pretension_kN} kN | k_tập trung: {currentProject.line.focusFactor}</div>
              {currentProject.anchor.mode === 'pile' ? (
                <>
                  <div>- Cọc bờ: BTCT vuông {currentProject.anchor.shoreD_m}m, ngàm {currentProject.anchor.shoreL_m}m</div>
                  <div>- Cọc lòng hồ: BTCT vuông {currentProject.anchor.bed1D_m}m, ngàm {currentProject.anchor.bed1L_m}m</div>
                </>
              ) : (
                <div>- Mỏ neo: {currentProject.anchor.anchorType} ({currentProject.anchor.weight_t} tấn, HC = {currentProject.anchor.holdingCoef})</div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Results & Formulas */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
            2. Kết Quả Tính Toán Lực & Sức Chịu Tải
          </h2>

          <table className="w-full text-xs text-left border border-slate-200 font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase">
              <tr>
                <th className="p-2 border-r border-b border-slate-200">Đại lượng</th>
                <th className="p-2 border-r border-b border-slate-200 text-right">Giá trị</th>
                <th className="p-2 border-r border-b border-slate-200">Đơn vị</th>
                <th className="p-2 border-b border-slate-200">Công thức / Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 border-r border-slate-200 font-sans">Tổng lực môi trường (F_env)</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold">{results.f_env_total_kN}</td>
                <td className="p-2 border-r border-slate-200">kN</td>
                <td className="p-2">F_wind ({results.f_wind_total_kN}kN) + F_current ({results.f_current_kN}kN)</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-sans">Lực căng dây lớn nhất (T_max)</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-brand-700">{results.t_max_intact_kN}</td>
                <td className="p-2 border-r border-slate-200">kN</td>
                <td className="p-2">
                  {results.tensionMethod === 'focus'
                    ? `F_env x ${currentProject.line.focusFactor} + T0 (hệ số tập trung tải)`
                    : `F_env / (${currentProject.line.effectiveCount} x cos ${currentProject.line.horizontalAngle_deg}°) + T0 (phân bố hình học)`}
                </td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-sans">Sức đứt yêu cầu (MBL_req)</td>
                <td className="p-2 border-r border-slate-200 text-right">{results.mbl_required_kN}</td>
                <td className="p-2 border-r border-slate-200">kN</td>
                <td className="p-2">T_max x {currentProject.criteria.sfLineIntact} (Hệ số an toàn cáp)</td>
              </tr>
              {results.shorePile && (
                <>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">Sức chịu ngang cọc neo BỜ (H_allow)</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold text-emerald-700">{results.shorePile.H_allow}</td>
                    <td className="p-2 border-r border-slate-200">kN</td>
                    <td className="p-2">Phương pháp Broms (Đất dính cu = {currentProject.anchor.cuShore_kPa} kPa, FS = 2.5)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">Mômen uốn cọc bờ (M_max / M_rd)</td>
                    <td className="p-2 border-r border-slate-200 text-right">{results.shorePile.Mmax} / {results.shorePile.Mrd}</td>
                    <td className="p-2 border-r border-slate-200">kNm</td>
                    <td className="p-2">
                      TCVN 5574:2018: M_rd = Rs·As·(a − 2a_s), {currentProject.anchor.shoreRebarFaceCount ?? 0}Φ{currentProject.anchor.shoreRebarDia_mm ?? 0} mặt
                      chịu kéo, Rs = {currentProject.anchor.pileRebarRs_MPa ?? 350} MPa; kiểm tra γ·M_max ≤ M_rd với γ = {currentProject.anchor.pileBendingLoadFactor ?? 1.2}
                    </td>
                  </tr>
                </>
              )}
              {results.bedBlock && (
                <>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">Neo đáy hồ PA2: lực ngang H / lực đứng V tại khối</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.H_kN.toFixed(1)} / {results.bedBlock.V_kN.toFixed(1)}</td>
                    <td className="p-2 border-r border-slate-200">kN</td>
                    <td className="p-2">H = T_max·cos α, V = T_max·sin α, α = {results.bedCableAngle_deg}° (tuyến cáp đáy ngắn nhất)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">Khối bê tông L × W × H</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.L_m.toFixed(2)} × {results.bedBlock.W_m.toFixed(2)} × {results.bedBlock.H_m.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200">m</td>
                    <td className="p-2">Diện tích đáy {results.bedBlock.baseArea_m2.toFixed(1)} m², thể tích {results.bedBlock.volume_m3.toFixed(1)} m³{results.bedBlock.bearingGovernsShape ? ' (đáy mở rộng theo áp lực nền)' : ''}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">Trọng lượng khô W_air / trong nước W_sub</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.weightAir_kN.toFixed(0)} / {results.bedBlock.weightSub_kN.toFixed(0)}</td>
                    <td className="p-2 border-r border-slate-200">kN</td>
                    <td className="p-2">W_air = {results.bedBlock.mass_t.toFixed(1)} tấn; W_sub = W_air·(1 − 1/{results.bedBlock.params.rhoConcrete_tm3})</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">DW-1 Chống trượt: SF = μ·(W_sub − V)/H</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.sfSlide.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200">-</td>
                    <td className="p-2">μ = {results.bedBlock.params.mu}, yêu cầu ≥ {results.bedBlock.params.sfSlide}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">DW-2 Chống nhấc bổng: SF = W_sub/V</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.sfUplift.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200">-</td>
                    <td className="p-2">Yêu cầu ≥ {results.bedBlock.params.sfUplift}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">DW-3 Chống lật: SF = (W_sub − V)·(L/2)/(H·h)</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.sfOverturn.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200">-</td>
                    <td className="p-2">Tai neo cao {results.bedBlock.params.tieHeight_m} m trên đáy khối, yêu cầu ≥ {results.bedBlock.params.sfOverturn}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-sans">DW-4 Áp lực nền bùn q</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedBlock.qContact_kPa.toFixed(1)}</td>
                    <td className="p-2 border-r border-slate-200">kPa</td>
                    <td className="p-2">Nước lặng {results.bedBlock.qStatic_kPa.toFixed(1)} / mép khi chịu tải {results.bedBlock.qEdge_kPa.toFixed(1)}; cho phép ≤ {results.bedBlock.params.qAllow_kPa} kPa (giả định)</td>
                  </tr>
                </>
              )}
              {!results.bedBlock && results.bedPile1 && (
                <tr>
                  <td className="p-2 border-r border-slate-200 font-sans">Sức chịu cọc LÒNG HỒ (H_all / Tv_all)</td>
                  <td className="p-2 border-r border-slate-200 text-right font-bold">{results.bedPile1.H_allow} / {results.bedPile1.upliftCapacity_all}</td>
                  <td className="p-2 border-r border-slate-200">kN</td>
                  <td className="p-2">Chịu ngang Broms & Chịu nhổ ma sát thân cọc</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Section 3: Check Table */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
            3. Bảng Đánh Giá Tiêu Chuẩn Kỹ Thuật (ĐẠT / KHÔNG ĐẠT)
          </h2>

          <table className="w-full text-xs text-left border border-slate-200 font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase">
              <tr>
                <th className="p-2 border-r border-b border-slate-200">Mã</th>
                <th className="p-2 border-r border-b border-slate-200">Điều kiện kiểm tra</th>
                <th className="p-2 border-r border-b border-slate-200 text-right">Giá trị tính</th>
                <th className="p-2 border-r border-b border-slate-200 text-right">Ngưỡng</th>
                <th className="p-2 border-r border-b border-slate-200 text-center">Độ an toàn</th>
                <th className="p-2 border-b border-slate-200 text-center">Kết luận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.checks.map(c => {
                const isPass = c.status === 'PASS';
                const isFail = c.status === 'FAIL';
                const isSkip = c.status === 'SKIP';
                const label = isPass ? 'ĐẠT' : isFail ? 'KHÔNG ĐẠT' : isSkip ? 'KHÔNG ÁP DỤNG' : 'N/A';
                const colorCls = isPass ? 'text-emerald-700' : isFail ? 'text-rose-700' : 'text-slate-500';

                return (
                  <tr key={c.id} className={isSkip ? 'opacity-70 bg-slate-50/50' : undefined}>
                    <td className="p-2 border-r border-slate-200 font-bold">{c.id}</td>
                    <td className="p-2 border-r border-slate-200 font-sans">{c.label}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{c.displayActual}</td>
                    <td className="p-2 border-r border-slate-200 text-right">{String(c.threshold)}</td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      {c.margin !== null ? `${(c.margin * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="p-2 text-center font-bold">
                      <span className={colorCls}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Technical comparison of the two lake-bed anchoring options (whole project) */}
        {isSolar && (
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              So sánh kỹ thuật hai phương án neo đáy hồ (toàn dự án, 12 cụm bè)
            </h2>
            <OptionComparisonView compact />
          </div>
        )}

        {/* Section 4: Attachments List */}
        {currentProject.attachments && currentProject.attachments.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              4. Tài Liệu & Bản Vẽ Kèm Theo Hồ Sơ
            </h2>
            <ul className="list-disc list-inside text-xs text-slate-700 font-mono space-y-0.5">
              {currentProject.attachments.map(a => (
                <li key={a.id}>{a.name} ({(a.size / 1024).toFixed(1)} KB)</li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 italic">
          <strong>Cam kết kỹ thuật:</strong> Kết quả mang tính tham khảo kỹ thuật. Các thông số vật liệu (MBL, hệ số bám neo, sức chịu cọc Broms) phải được kiểm chứng theo catalogue nhà sản xuất và quy chuẩn áp dụng.
        </div>

        {/* Signatures */}
        <div className="pt-6 grid grid-cols-3 text-center text-xs">
          <div>
            <div className="font-bold text-slate-800">NGƯỜI LẬP BÁO CÁO</div>
            <div className="text-[11px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</div>
            <div className="h-16"></div>
            <div className="font-semibold text-slate-800">{meta.designer || 'Kỹ sư thiết kế'}</div>
          </div>

          <div>
            <div className="font-bold text-slate-800">NGƯỜI KIỂM TRA</div>
            <div className="text-[11px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</div>
            <div className="h-16"></div>
            <div className="font-semibold text-slate-800">Chủ trì kết cấu</div>
          </div>

          <div>
            <div className="font-bold text-slate-800">CHỦ NHIỆM DỰ ÁN</div>
            <div className="text-[11px] text-slate-500 mt-0.5">(Ký và đóng dấu)</div>
            <div className="h-16"></div>
            <div className="font-semibold text-slate-800">Ban Quản Lý Dự Án</div>
          </div>
        </div>
      </div>
    </div>
  );
};
