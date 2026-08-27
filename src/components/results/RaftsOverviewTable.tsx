import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Table, CheckCircle2, XCircle, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

const VerdictPill: React.FC<{ verdict: 'PASS' | 'FAIL' | 'NA' }> = ({ verdict }) => {
  if (verdict === 'PASS') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
        <CheckCircle2 className="w-3.5 h-3.5" /> ĐẠT
      </span>
    );
  }
  if (verdict === 'FAIL') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
        <XCircle className="w-3.5 h-3.5" /> KHÔNG ĐẠT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
      <AlertTriangle className="w-3.5 h-3.5" /> N/A
    </span>
  );
};

export const RaftsOverviewTable: React.FC = () => {
  const { raftsSummary, activeRaftId, setActiveRaft, batchResults, batchCalculatedAt, calculateAllRafts } = useProjectStore();

  useEffect(() => {
    if (batchResults.length === 0) calculateAllRafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!raftsSummary || raftsSummary.length === 0) return null;

  const byId = new Map(batchResults.map((b) => [b.raft.id, b]));
  const passCount = batchResults.filter((b) => b.results.overallVerdict === 'PASS').length;
  const failCount = batchResults.filter((b) => b.results.overallVerdict === 'FAIL').length;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              Bảng Tổng Hợp {raftsSummary.length} Cụm Bè Pin Mặt Trời (Hồ Huổi Vanh)
            </h3>
            <p className="card-subtitle">
              Kết quả tính toán chi tiết từng bè: tải trọng, lực căng cáp, hệ số an toàn neo/cọc và kết luận ĐẠT/KHÔNG ĐẠT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {batchResults.length > 0 && (
            <div className="text-[11px] font-mono text-slate-500">
              <span className="text-emerald-600 font-bold">{passCount} ĐẠT</span>
              {failCount > 0 && <span className="text-rose-600 font-bold"> · {failCount} KHÔNG ĐẠT</span>}
              {batchCalculatedAt && (
                <span className="block text-slate-400">
                  Cập nhật: {new Date(batchCalculatedAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => calculateAllRafts()}
            className="btn btn-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tính lại toàn bộ ({raftsSummary.length} bè)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5">Cụm Bè</th>
              <th className="px-3 py-2.5 text-right">Diện tích (m²)</th>
              <th className="px-3 py-2.5 text-right">Kích thước (m)</th>
              <th className="px-3 py-2.5 text-right">Số tấm pin</th>
              <th className="px-3 py-2.5 text-center">Số dây (Bờ/Đáy)</th>
              <th className="px-3 py-2.5 text-center">Cáp / MBL</th>
              <th className="px-3 py-2.5 text-right">F_env (kN)</th>
              <th className="px-3 py-2.5 text-right">T_max (kN)</th>
              <th className="px-3 py-2.5 text-right">η cáp</th>
              <th className="px-3 py-2.5 text-right">η cọc bờ (H/M)</th>
              <th className="px-3 py-2.5 text-right">η cọc đáy (H/Nhổ)</th>
              <th className="px-3 py-2.5 text-center">Hạng mục chi phối</th>
              <th className="px-3 py-2.5 text-center">Kết luận</th>
              <th className="px-3 py-2.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {raftsSummary.map((r) => {
              const isActive = r.id === activeRaftId;
              const b = byId.get(r.id);
              const res = b?.results;
              const cableEta = res?.cableUtilization;
              const cableEtaCls = cableEta === null || cableEta === undefined
                ? 'text-slate-400'
                : cableEta > 1 ? 'text-rose-600 font-bold' : cableEta > 0.85 ? 'text-amber-600 font-bold' : 'text-emerald-600';

              return (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    isActive ? 'bg-brand-50/60 font-semibold' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-slate-900 font-sans">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.area_m2.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.length_m} x {r.width_m}</td>
                  <td className="px-3 py-2 text-right">{r.solarPanelCount || Math.round(r.area_m2 * 0.22)}</td>
                  <td className="px-3 py-2 text-center font-bold">
                    {r.cableCount} <span className="font-normal text-slate-500">({r.shoreAnchors}/{r.bedAnchors})</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      {r.selectedCable}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{res ? res.f_env_total_kN.toFixed(1) : '…'}</td>
                  <td className="px-3 py-2 text-right font-bold text-brand-700">{res ? res.t_max_intact_kN.toFixed(1) : '…'}</td>
                  <td className={`px-3 py-2 text-right ${cableEtaCls}`}>
                    {cableEta !== null && cableEta !== undefined ? cableEta.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {res?.shorePile ? `${res.shorePile.utilization_H.toFixed(2)} / ${res.shorePile.utilization_M.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {res?.bedPile1 ? `${res.bedPile1.utilization_H.toFixed(2)} / ${(res.bedPile1.utilization_Uplift ?? 0).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-center text-[11px] text-slate-600 font-sans">
                    {res?.governingCheck ? `${res.governingCheck.id} · ${res.governingCheck.label}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {res ? <VerdictPill verdict={res.overallVerdict === 'PASS' ? 'PASS' : res.overallVerdict === 'FAIL' ? 'FAIL' : 'NA'} /> : (
                      <span className="text-[11px] text-slate-400">Đang tính…</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setActiveRaft(r.id)}
                      className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded-lg flex items-center gap-1 mx-auto transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isActive ? 'Đang chọn' : 'Tính bè này'}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
