import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Table, CheckCircle2, ArrowRight } from 'lucide-react';

export const RaftsOverviewTable: React.FC = () => {
  const { raftsSummary, activeRaftId, setActiveRaft } = useProjectStore();

  if (!raftsSummary || raftsSummary.length === 0) return null;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              Bảng Tổng Hợp 13 Cụm Bè Pin Mặt Trời (Hồ Huổi Vanh)
            </h3>
            <p className="card-subtitle">
              Tổng quan kích thước, số lượng cáp neo, cọc neo và phương án cáp được lựa chọn
            </p>
          </div>
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
              <th className="px-3 py-2.5 text-center">Hệ số tập trung</th>
              <th className="px-3 py-2.5 text-center">Số dây (Bờ / Đáy)</th>
              <th className="px-3 py-2.5 text-center">Cáp đã chọn</th>
              <th className="px-3 py-2.5 text-center">Kiểm tra</th>
              <th className="px-3 py-2.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {raftsSummary.map((r) => {
              const isActive = r.id === activeRaftId;
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
                  <td className="px-3 py-2 text-center text-slate-700">{r.focusFactor}</td>
                  <td className="px-3 py-2 text-center font-bold">
                    {r.cableCount} <span className="font-normal text-slate-500">({r.shoreAnchors} bờ / {r.bedAnchors} đáy)</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      {r.selectedCable}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ĐẠT
                    </span>
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
