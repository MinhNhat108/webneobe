import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { FolderKanban, Plus, RefreshCw, Layers } from 'lucide-react';

export const ProjectForm: React.FC = () => {
  const {
    currentProject,
    updateMeta,
    activeRaftId,
    setActiveRaft,
    raftsSummary,
    createNewProject,
    resetToHuoiVanh
  } = useProjectStore();

  const meta = currentProject.meta;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-brand-50 text-brand-600">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="card-title">Quản Lý & Thông Tin Dự Án</h2>
            <p className="card-subtitle">
              Chọn dự án đang thực hiện hoặc chuyển đổi giữa các cụm bè
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => resetToHuoiVanh()}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Tải lại dữ liệu dự án Hồ Huổi Vanh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Dữ liệu gốc Huổi Vanh
          </button>

          <button
            type="button"
            onClick={() => {
              const name = prompt('Nhập tên dự án mới:', 'Dự án Hệ Neo Bè Mới');
              if (name) createNewProject(name, 'solar_fpv');
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo dự án mới
          </button>
        </div>
      </div>

      {/* System Type Info */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Loại hình kết cấu hệ neo:
          </span>
          <p className="card-subtitle">
            Hệ bè pin mặt trời nổi trên hồ chứa (12 cụm bè, cáp PES & cọc neo Broms)
          </p>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm">
            ⚡ Điện Mặt Trời Nổi (FPV)
          </span>
        </div>
      </div>

      {/* Multi-Raft Quick Bar (for Huổi Vanh 12 bè) */}
      {currentProject.systemType === 'solar_fpv' && raftsSummary && raftsSummary.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-600" />
              Chọn cụm bè cần tính toán chi tiết (13 Bè):
            </span>
            <span className="card-subtitle">
              Đang chọn: <strong className="text-brand-600 font-bold">{raftsSummary.find(r => r.id === activeRaftId)?.name || `BÈ ${activeRaftId}`}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {raftsSummary.map((raft) => {
              const isActive = raft.id === activeRaftId;
              return (
                <button
                  key={raft.id}
                  type="button"
                  onClick={() => setActiveRaft(raft.id)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                    isActive
                      ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-300 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold">{raft.name}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{raft.area_m2.toLocaleString()} m²</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="field-grid">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tên dự án</label>
          <input
            type="text"
            value={meta.name}
            onChange={(e) => updateMeta({ name: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            placeholder="Dự án Điện Mặt Trời..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Mã dự án (Code)</label>
          <input
            type="text"
            value={meta.code}
            onChange={(e) => updateMeta({ code: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none font-mono"
            placeholder="HV-FPV-2026"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Địa điểm thực hiện</label>
          <input
            type="text"
            value={meta.location}
            onChange={(e) => updateMeta({ location: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            placeholder="Hồ chứa nước..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Kỹ sư thiết kế</label>
          <input
            type="text"
            value={meta.designer}
            onChange={(e) => updateMeta({ designer: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            placeholder="Kỹ sư Thủy công / Kết cấu"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Ngày lập tính toán</label>
          <input
            type="date"
            value={meta.date}
            onChange={(e) => updateMeta({ date: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none font-mono"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú dự án</label>
          <input
            type="text"
            value={meta.note}
            onChange={(e) => updateMeta({ note: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            placeholder="Ghi chú hồ sơ hoặc tiêu chuẩn áp dụng"
          />
        </div>
      </div>
    </div>
  );
};
