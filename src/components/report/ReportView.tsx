import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Printer, CheckCircle2, XCircle } from 'lucide-react';

export const ReportView: React.FC = () => {
  const { currentProject, results, batchResults, calculateAllRafts, raftsSummary } = useProjectStore();
  const meta = currentProject.meta;
  const isSolar = currentProject.systemType === 'solar_fpv';

  useEffect(() => {
    if (raftsSummary.length > 0 && batchResults.length === 0) calculateAllRafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print action toolbar (hidden on print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Xem Trước & In Báo Cáo Kỹ Thuật (Khổ A4)
          </h3>
          <p className="text-xs text-slate-500">
            Báo cáo được định dạng chuẩn in ấn tài liệu thuyết minh thiết kế
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          In Báo Cáo / Xuất PDF
        </button>
      </div>

      {/* Printable Report Document */}
      <div className="print-page bg-white p-8 md:p-12 rounded-xl border border-slate-200 shadow-sm text-slate-900 font-sans space-y-6 max-w-4xl mx-auto">
        {/* Report Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              BÁO CÁO THUYẾT MINH TÍNH TOÁN KỸ THUẬT
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
              {meta.name || currentProject.name}
            </h1>
            <div className="text-xs text-slate-600 mt-1">
              Hệ thống: Hệ Bè Pin Mặt Trời Nổi (FPV)
            </div>
          </div>

          <div className="text-right text-xs font-mono space-y-0.5 shrink-0">
            <div>Mã số: <strong>{meta.code || currentProject.code}</strong></div>
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
            1. Bảng Thông Số Thiết Kế Đầu Vào
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="font-bold text-slate-800 font-sans mb-1">Hình học Bè & Tải Trọng:</div>
              <div>- Kích thước: {currentProject.raft.length_m}m x {currentProject.raft.width_m}m (S = {(currentProject.raft.length_m * currentProject.raft.width_m).toLocaleString()} m²)</div>
              <div>- Mớn nước: {currentProject.raft.draft_m}m | Chiều cao nổi: {currentProject.raft.freeboardHeight_m}m</div>
              {isSolar && (
                <div>- Số tấm pin: {currentProject.raft.solarPanelCount} tấm (Góc nghiêng {currentProject.raft.solarTilt_deg}°)</div>
              )}
              <div>- Vận tốc gió thiết kế: {currentProject.env.windSpeed_ms} m/s (q = {results.q_wind_Pa} Pa)</div>
              <div>- Độ sâu hồ: {currentProject.env.waterDepth_m}m | Dao động: {currentProject.env.tideRange_m}m</div>
            </div>

            <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="font-bold text-slate-800 font-sans mb-1">Quy cách Dây Neo & Cọc/Mỏ Neo:</div>
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
                    <td className="p-2">Kiểm tra tiết diện bê tông B25</td>
                  </tr>
                </>
              )}
              {results.bedPile1 && (
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

        {/* Section 4b: Master summary appendix across every raft cluster */}
        {batchResults.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              Phụ Lục A — Bảng Tổng Hợp Toàn Bộ {batchResults.length} Cụm Bè
            </h2>
            <table className="w-full text-[10.5px] text-left border border-slate-200 font-mono">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="p-1.5 border-r border-b border-slate-200 font-sans">Bè</th>
                  <th className="p-1.5 border-r border-b border-slate-200 text-right">S (m²)</th>
                  <th className="p-1.5 border-r border-b border-slate-200 text-right">F_env (kN)</th>
                  <th className="p-1.5 border-r border-b border-slate-200 text-right">T_max (kN)</th>
                  <th className="p-1.5 border-r border-b border-slate-200 text-right">η cáp</th>
                  <th className="p-1.5 border-r border-b border-slate-200 font-sans">Hạng mục chi phối</th>
                  <th className="p-1.5 border-b border-slate-200 text-center font-sans">Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batchResults.map((b) => {
                  const v = b.results.overallVerdict;
                  const label = v === 'PASS' ? 'ĐẠT' : v === 'FAIL' ? 'KHÔNG ĐẠT' : 'N/A';
                  const cls = v === 'PASS' ? 'text-emerald-700' : v === 'FAIL' ? 'text-rose-700' : 'text-slate-500';
                  return (
                    <tr key={b.raft.id}>
                      <td className="p-1.5 border-r border-slate-200 font-bold font-sans">{b.raft.name}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right">{b.raft.area_m2.toLocaleString()}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right">{b.results.f_env_total_kN}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right">{b.results.t_max_intact_kN}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right">{b.results.cableUtilization ?? '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 font-sans">
                        {b.results.governingCheck ? `${b.results.governingCheck.id} — ${b.results.governingCheck.label}` : '-'}
                      </td>
                      <td className={`p-1.5 text-center font-bold font-sans ${cls}`}>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
