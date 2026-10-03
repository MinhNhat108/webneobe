import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { exportProjectToExcel, exportPileScheduleToExcel } from '../../lib/io/excelExport';
import { exportMooringPileDxf } from '../../lib/io/dxfExport';
import { exportMooringDeadweightDxf } from '../../lib/io/deadweightDxf';
import { exportDeadweightScheduleToExcel } from '../../lib/io/deadweightExcel';
import {
  Anchor,
  FileSpreadsheet,
  Download,
  DraftingCompass,
  Table,
  Printer,
  RefreshCw,
  Lock,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  onOpenImport: () => void;
  onGoToReport: () => void;
  onGoToCompare?: () => void;
  onGoToGuide?: () => void;
  onLock?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenImport, onGoToReport, onGoToCompare, onGoToGuide, onLock }) => {
  const { currentProject, results, recalculate, raftsSummary, batchResults, calculateAllRafts, setMooringOption } = useProjectStore();
  const handleExportExcel = () => {
    // The Master sheet and per-raft detailed checks need batch data — compute
    // it on demand if the user exports before ever opening the overview tab.
    const batch = batchResults.length > 0 ? batchResults : calculateAllRafts();
    exportProjectToExcel(currentProject, results, raftsSummary, batch);
  };

  const mooringOption = currentProject.anchor.bedAnchorOption ?? 'PA1_PILE';
  const isPa2 = mooringOption === 'PA2_DEADWEIGHT';

  // The schedule and the drawing follow the selected lake-bed option.
  const handleExportPileSchedule = () => {
    const batch = batchResults.length > 0 ? batchResults : calculateAllRafts();
    if (isPa2) exportDeadweightScheduleToExcel(currentProject, results, batch);
    else exportPileScheduleToExcel(currentProject, results, batch);
  };

  const handleExportDxf = () => {
    // Same on-demand batch as the Excel export: every pile in the schedule
    // takes its L_opt / P_max from its own raft's calculation.
    const batch = batchResults.length > 0 ? batchResults : calculateAllRafts();
    if (isPa2) {
      const built = exportMooringDeadweightDxf(currentProject, results, batch);
      // eslint-disable-next-line no-console
      console.info(`[DXF PA2] Đã xuất ${built.shorePileCount} cọc bờ + ${built.blockCount} khối bê tông / ${built.raftCount} cụm bè.`);
      return;
    }
    const built = exportMooringPileDxf(currentProject, results, batch);
    // eslint-disable-next-line no-console
    console.info(
      `[DXF] Đã xuất ${built.pileCount} cọc neo / ${built.raftCount} cụm bè.`
    );
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-app mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-inner shrink-0">
            <Anchor className="w-5 h-5 text-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white truncate">
                {currentProject.name || 'Phần Mềm Tính Hệ Neo Bè'}
              </h1>
              <span className="text-[10px] font-mono bg-brand-500/20 text-brand-300 border border-brand-500/30 px-1.5 py-0.5 rounded font-semibold shrink-0">
                {currentProject.code || 'DA-2026'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              ⚡ Điện mặt trời nổi (FPV) — Hồ Huổi Vanh (12 Bè)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={recalculate}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Tính toán lại toàn bộ"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onGoToGuide && (
            <button
              type="button"
              onClick={onGoToGuide}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-brand-300 hover:text-brand-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Xem hướng dẫn sử dụng tính toán"
            >
              <BookOpen className="w-4 h-4 text-brand-400" />
              <span className="hidden lg:inline">Hướng Dẫn</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenImport}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Nhập thông số từ file Excel/CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Nhập Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Xuất toàn bộ bảng tính dự án ra Excel (.xlsx, 7 sheet)"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPileSchedule}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title={isPa2
              ? 'Xuất Bảng thống kê PA2: 129 cọc neo bờ + 175 khối bê tông neo đáy ra Excel (.xlsx)'
              : 'Xuất riêng Bảng Thống Kê Cọc Neo (304 cọc, L_opt, P_max) ra Excel (.xlsx)'}
          >
            <Table className="w-4 h-4 text-emerald-400" />
            <span className="hidden xl:inline">{isPa2 ? 'Bảng Neo PA2 Excel' : 'Bảng Cọc Excel'}</span>
            <span className="hidden md:inline xl:hidden">{isPa2 ? 'Bảng Neo' : 'Bảng Cọc'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportDxf}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title={isPa2
              ? 'Xuất bản vẽ CAD PA2: Khối bê tông neo đáy hồ & Cọc neo bờ (.DXF)'
              : 'Xuất bản vẽ mặt bằng đóng cọc neo ra CAD (.DXF) — kèm bảng thống kê cọc (L_opt, P_max)'}
          >
            <DraftingCompass className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Xuất CAD</span>
          </button>

          <button
            type="button"
            onClick={onGoToReport}
            className="px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-sky-600 hover:from-brand-500 hover:to-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-900/40 transition-all"
            title="Xem và in báo cáo kỹ thuật"
          >
            <Printer className="w-4 h-4" />
            <span>In Báo Cáo</span>
          </button>

          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 hover:border-amber-500/40 ml-1"
              title="Khóa trang / Đăng xuất"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lake-bed anchoring option. PA1 is the design; PA2 replaces the lake-bed piles with gravity blocks. */}
      <div className="border-t border-slate-800 bg-slate-950/60">
        <div className="max-w-app mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Phương án neo đáy hồ:</span>
          <button
            type="button"
            onClick={() => setMooringOption('PA1_PILE')}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              mooringOption === 'PA1_PILE'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🟢 Phương án 1: Cọc đóng BTCT (thiết kế)
          </button>
          <button
            type="button"
            onClick={() => setMooringOption('PA2_DEADWEIGHT')}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              mooringOption === 'PA2_DEADWEIGHT'
                ? 'bg-amber-500 border-amber-400 text-slate-900'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🟡 Phương án 2: Khối bê tông neo đáy
          </button>
          {mooringOption === 'PA2_DEADWEIGHT' && (
            <span className="text-amber-300">
              Đang chọn Phương án 2: 175 khối bê tông neo đáy (DW-1…DW-4) + 129 cọc neo bờ. Nút "Bảng Neo" và "Xuất CAD" xuất theo khối bê tông.
            </span>
          )}
          {onGoToCompare && (
            <button type="button" onClick={onGoToCompare} className="ml-auto text-brand-300 hover:text-brand-200 underline">
              Xem so sánh kỹ thuật
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
