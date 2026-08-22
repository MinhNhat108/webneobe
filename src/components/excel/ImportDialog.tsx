import React, { useState } from 'react';
import { parseSpreadsheet, generateTemplateWorkbook, applyParamsToProjectState, ParsedSheetData } from '../../lib/io/excelImport';
import { PreviewGrid } from './PreviewGrid';
import { useProjectStore } from '../../store/useProjectStore';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  Table,
  CheckCircle2
} from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const { currentProject, importProjectState } = useProjectStore();
  const [parsedSheets, setParsedSheets] = useState<ParsedSheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Dung lượng file vượt quá giới hạn 10 MB.');
      return;
    }

    try {
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      const sheets = parseSpreadsheet(buffer);
      if (sheets.length === 0) {
        setError('File không chứa sheet hoặc dữ liệu nào.');
        return;
      }
      setParsedSheets(sheets);
      setActiveSheetIdx(0);
      setSuccessMsg(`Đã nạp thành công file ${file.name} với ${sheets.length} sheet.`);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi đọc file Excel/CSV');
    }
  };

  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    const nextSheets = [...parsedSheets];
    const curSheet = nextSheets[activeSheetIdx];
    if (curSheet && curSheet.rawRows[rowIdx]) {
      curSheet.rawRows[rowIdx][colIdx] = val;
      setParsedSheets(nextSheets);
    }
  };

  const handleApply = () => {
    try {
      let nextState = JSON.parse(JSON.stringify(currentProject));

      // 1. If key-value params exist in parsed sheets
      for (const sheet of parsedSheets) {
        if (sheet.parsedParams) {
          nextState = applyParamsToProjectState(nextState, sheet.parsedParams);
        }
      }

      // 2. Also check if user edited first sheet key-value pairs in the preview grid
      const curSheet = parsedSheets[activeSheetIdx];
      if (curSheet && curSheet.rawRows) {
        for (const row of curSheet.rawRows) {
          if (row && row[0] && typeof row[0] === 'string' && row[1] !== undefined) {
            const code = row[0].trim().toUpperCase();
            if (code === 'RAFT_LENGTH' || code.includes('CHIỀU DÀI BÈ')) nextState.raft.length_m = parseFloat(String(row[1]));
            if (code === 'RAFT_WIDTH' || code.includes('CHIỀU RỘNG BÈ')) nextState.raft.width_m = parseFloat(String(row[1]));
            if (code === 'WIND_SPEED' || code.includes('VẬN TỐC GIÓ')) nextState.env.windSpeed_ms = parseFloat(String(row[1]));
            if (code === 'WATER_DEPTH' || code.includes('ĐỘ SÂU NƯỚC')) nextState.env.waterDepth_m = parseFloat(String(row[1]));
            if (code === 'LINE_COUNT' || code.includes('SỐ DÂY')) nextState.line.count = parseInt(String(row[1]));
            if (code === 'LINE_MBL' || code.includes('MBL')) nextState.line.mbl_kN = parseFloat(String(row[1]));
          }
        }
      }

      importProjectState(nextState);
      alert(`Đã áp dụng thành công các thông số từ file ${fileName} vào dự án!`);
      onClose();
    } catch (err: any) {
      setError(`Không thể áp dụng dữ liệu: ${err?.message}`);
    }
  };

  const currentSheet = parsedSheets[activeSheetIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nhập Dữ Liệu Từ Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ định dạng Key-Value hoặc bảng biểu (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Top Actions: Upload & Download Template */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl bg-slate-50 hover:bg-brand-50/30 cursor-pointer transition-all">
              <Upload className="w-6 h-6 text-brand-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {fileName ? `Đã chọn: ${fileName}` : 'Chọn file Excel (.xlsx, .xls, .csv)'}
                </div>
                <div className="text-[11px] text-slate-500">Nhấn để mở hộp thoại tải file lên</div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={generateTemplateWorkbook}
              className="flex items-center gap-3 p-4 border border-slate-200 hover:border-emerald-500 rounded-xl bg-white hover:bg-emerald-50/30 text-left transition-all group"
            >
              <Download className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <div className="text-xs font-bold text-slate-800">Tải file mẫu chuẩn (.xlsx)</div>
                <div className="text-[11px] text-slate-500">
                  File mẫu chứa đầy đủ mã key để điền thông số nhanh
                </div>
              </div>
            </button>
          </div>

          {/* Status Alert */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Parsed Sheet Viewer */}
          {parsedSheets.length > 0 && (
            <div className="space-y-3">
              {/* Sheet tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                <span className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                  <Table className="w-3.5 h-3.5" /> Sheet:
                </span>
                {parsedSheets.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSheetIdx(idx)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                      activeSheetIdx === idx
                        ? 'bg-brand-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s.sheetName}
                  </button>
                ))}
              </div>

              {/* Editable Preview Grid */}
              {currentSheet && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Xem trước dữ liệu (Bạn có thể bấm đúp vào ô để chỉnh sửa giá trị trước khi nạp):
                    </span>
                    <span className="font-mono">{currentSheet.rawRows.length} dòng</span>
                  </div>
                  <PreviewGrid
                    data={currentSheet.rawRows}
                    onCellChange={handleCellChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={parsedSheets.length === 0}
            onClick={handleApply}
            className={`px-5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm ${
              parsedSheets.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-200'
            }`}
          >
            <Check className="w-4 h-4" />
            Áp dụng vào biểu mẫu tính toán
          </button>
        </div>
      </div>
    </div>
  );
};
