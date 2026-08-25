import React from 'react';
import {
  FolderKanban,
  SlidersHorizontal,
  Map,
  Calculator,
  Paperclip,
  Printer,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export type ActiveSection = 'project' | 'input' | 'map' | 'results' | 'files' | 'report' | 'guide';

interface SidebarProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSelectSection }) => {
  const { results, currentProject } = useProjectStore();

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'project',
      label: '1. Dự Án & Cụm Bè',
      description: 'Quản lý dự án & chọn cụm bè',
      icon: FolderKanban
    },
    {
      id: 'input',
      label: '2. Thông Số Đầu Vào',
      description: 'Bè, Môi trường, Cáp & Cọc',
      icon: SlidersHorizontal
    },
    {
      id: 'map',
      label: '3. Mặt Bằng & Tọa Độ Neo',
      description: 'Bản đồ 12 bè & 299 điểm neo',
      icon: Map
    },
    {
      id: 'results',
      label: '4. Kết Quả & Kiểm Tra',
      description: 'Bảng kiểm tra ĐẠT / KHÔNG ĐẠT',
      icon: Calculator,
      badge: (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            results.overallVerdict === 'PASS'
              ? 'bg-emerald-100 text-emerald-800'
              : results.overallVerdict === 'FAIL'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {results.overallVerdict === 'PASS' ? 'ĐẠT' : results.overallVerdict === 'FAIL' ? 'K.ĐẠT' : 'N/A'}
        </span>
      )
    },
    {
      id: 'files',
      label: '5. Tài Liệu Đính Kèm',
      description: 'Bản vẽ PDF, DXF, bảng tính',
      icon: Paperclip,
      badge: (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
          {(currentProject.attachments || []).length}
        </span>
      )
    },
    {
      id: 'report',
      label: '6. Báo Cáo Kỹ Thuật',
      description: 'Thuyết minh in ấn khổ A4',
      icon: Printer
    },
    {
      id: 'guide',
      label: '7. Hướng Dẫn Sử Dụng',
      description: 'Quy trình, công thức & FAQ',
      icon: BookOpen,
      badge: (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-800">
          HDSD
        </span>
      )
    }
  ];

  return (
    <aside className="no-print w-64 lg:w-72 bg-white border-r border-slate-200 shrink-0 flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 shadow-sm overflow-y-auto">
      <div className="p-4 space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
          Quy trình tính toán
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-brand-50/80 text-brand-900 border border-brand-200 font-medium shadow-sm'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isActive ? 'text-brand-600' : 'text-slate-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">{item.label}</span>
                  {item.badge}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mini status footer strip in sidebar */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs">
        <div className="flex items-center justify-between text-slate-600 mb-1">
          <span>Trạng thái hệ neo:</span>
          <span className="font-bold font-mono">
            {results.overallVerdict === 'PASS' ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ĐẠT
              </span>
            ) : results.overallVerdict === 'FAIL' ? (
              <span className="text-rose-600 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> KHÔNG ĐẠT
              </span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> N/A
              </span>
            )}
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          Tự động lưu vào bộ nhớ trình duyệt
        </div>
      </div>
    </aside>
  );
};
