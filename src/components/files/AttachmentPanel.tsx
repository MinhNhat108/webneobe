import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Attachment } from '../../lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../data/huoiVanhProject';
import { ACTIVE_LAKE, ACTIVE_LAKE_ID } from '../../data/lakes';
import { resolveAssetUrl } from '../../lib/utils/assetUrl';
import { PdfViewer } from './PdfViewer';
import { ImageViewer } from './ImageViewer';
import { DxfViewer } from './DxfViewer';
import {
  Paperclip,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  Trash2,
  Eye,
  FileCheck,
  RotateCcw,
  Download
} from 'lucide-react';

export const AttachmentPanel: React.FC = () => {
  const { currentProject, addAttachment, removeAttachment } = useProjectStore();
  const attachments = currentProject.attachments || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Restore the default attachments of the active lake's project
  const handleRestoreHuoiVanhDocs = () => {
    const defaultAtts = (HUOI_VANH_DEFAULT_PROJECT as any).attachments || [];
    useProjectStore.setState((state) => ({
      currentProject: {
        ...state.currentProject,
        attachments: defaultAtts
      }
    }));
    if (defaultAtts.length > 0) {
      setSelectedId(defaultAtts[0].id);
    }
  };

  // Handle local file upload
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        alert(`File ${file.name} vượt quá dung lượng cho phép (tối đa 25 MB).`);
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let kind: Attachment['kind'] = 'other';
      if (ext === 'pdf') kind = 'pdf';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) kind = 'image';
      else if (ext === 'dxf') kind = 'dxf';

      const blobUrl = URL.createObjectURL(file);
      const newAtt: Attachment = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        kind,
        blobUrl
      };

      addAttachment(newAtt);
      if (!selectedId) setSelectedId(newAtt.id);
    });
  };

  const currentAttachment = attachments.find((a) => a.id === selectedId) || attachments[0];

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-violet-50 text-violet-600">
            <Paperclip className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              Tài Liệu Đính Kèm & Bản Vẽ Kỹ Thuật
            </h3>
            <p className="card-subtitle">
              Quản lý hồ sơ thiết kế, bản vẽ CAD (.dxf) {HUOI_VANH_RAFTS.length} bè, thuyết minh PDF và xem trước trực tiếp trên web
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Upload & File List */}
        <div className="space-y-4">
          {/* Drag & drop upload box */}
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl bg-slate-50 hover:bg-brand-50/40 cursor-pointer transition-all text-center group">
            <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-brand-600 mb-2 transition-colors" />
            <span className="text-xs font-semibold text-slate-700 group-hover:text-brand-700">
              Kéo thả hoặc nhấn để tải tài liệu lên
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Hỗ trợ PDF, PNG, JPG, DXF, XLSX (Tối đa 25 MB/file)
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.dxf,.xlsx,.xls,.csv"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>

          {/* Preset project docs banner (active lake) */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                Hồ sơ kỹ thuật {ACTIVE_LAKE.name}:
              </div>
              <button
                type="button"
                onClick={handleRestoreHuoiVanhDocs}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                title="Khôi phục danh mục tài liệu mặc định"
              >
                <RotateCcw className="w-3 h-3" />
                Đồng bộ lại
              </button>
            </div>
            {ACTIVE_LAKE_ID === 'ban-mong' ? (
              <>
                <p className="text-slate-600 text-[11px]">
                  Hồ sơ gốc của hồ Bản Mòng (chỉ tài liệu của hồ này):
                </p>
                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
                  <li><strong>Thuyết minh tính toán, bảng tính Excel, bản vẽ neo 6 bè</strong> (30/10/2026, 16.912 tấm pin, .docx / .xlsx / .dxf / .dwg)</li>
                  <li><strong>Thống kê vật tư neo, cáp neo</strong> và <strong>vật tư bè pin</strong> (.xlsx), bảng thống kê neo từng điểm</li>
                  <li><strong>Khung kết cấu 6 bè có hộp 40x60 gia cường tại vị trí neo</strong> (.dwg) và sơ đồ tổng GC-01</li>
                  <li><strong>Bố trí bè pin 6 bè của Chủ đầu tư</strong> (.dwg, .pdf CT-BP), đường bao bè, mực nước, địa hình IFC</li>
                </ul>
                <p className="text-slate-500 text-[11px]">
                  Hồ sơ tính toán neo của Bản Mòng là hồ sơ ĐỂ XEM XÉT: phương án neo, thiết bị bù mực nước + khóa bão, đế đơn và khảo sát địa chất chưa được chốt (xem mục 8 thuyết minh).
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-600 text-[11px]">
                  Tài liệu của phương án chốt (cọc khoan nhồi ven bờ + đế BTCT vít xoắn), <strong>tính lại ngày 23/10/2026</strong> với lực dây cân bằng theo mực nước (chỉnh dây mỗi 1 m mực nước):
                </p>
                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
                  <li><strong>Thuyết minh tính toán</strong> (.docx)</li>
                  <li><strong>Bảng tính Excel</strong> (.xlsx, kèm sheet cân bằng theo từng mực nước)</li>
                  <li><strong>Bản vẽ CAD bố trí neo</strong> (.dxf, mở được bằng AutoCAD và xem ngay trên web)</li>
                  <li><strong>Thống kê vật tư neo, cáp neo</strong> và <strong>vật tư bè pin</strong> (.xlsx)</li>
                </ul>
                <p className="text-slate-500 text-[11px]">
                  Bản tính cũ (12/10/2026, góc dây 30° + hệ số tập trung) đã được thay thế, lưu riêng để đối chiếu.
                </p>
              </>
            )}
          </div>

          {/* Files List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Danh sách tài liệu ({attachments.length}):
              </span>
            </div>

            {attachments.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 border border-slate-100 rounded-lg">
                Chưa có tài liệu nào. Bấm "Đồng bộ lại" ở trên để nạp hồ sơ mẫu.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {attachments.map((att) => {
                  const isSelected = currentAttachment?.id === att.id;
                  return (
                    <div
                      key={att.id}
                      onClick={() => setSelectedId(att.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/70 text-brand-900 font-medium shadow-sm ring-1 ring-brand-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {att.kind === 'pdf' && <FileText className="w-4 h-4 text-rose-500 shrink-0" />}
                        {att.kind === 'image' && <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />}
                        {att.kind === 'dxf' && <FileCode className="w-4 h-4 text-sky-500 shrink-0" />}
                        {att.kind === 'other' && <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <span className="truncate" title={att.name}>{att.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(att.id);
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900"
                          title="Xem trước"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(att.id);
                            if (selectedId === att.id) setSelectedId(null);
                          }}
                          className="p-1 hover:bg-rose-100 rounded text-slate-400 hover:text-rose-600"
                          title="Xóa tài liệu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Preview Canvas / Viewer */}
        <div className="lg:col-span-2 min-h-[580px]">
          {currentAttachment ? (
            <>
              {currentAttachment.kind === 'pdf' && (
                <PdfViewer
                  url={currentAttachment.blobUrl || currentAttachment.remoteUrl || ''}
                  name={currentAttachment.name}
                />
              )}
              {currentAttachment.kind === 'image' && (
                <ImageViewer
                  url={currentAttachment.blobUrl || currentAttachment.remoteUrl || ''}
                  name={currentAttachment.name}
                />
              )}
              {currentAttachment.kind === 'dxf' && (
                <DxfViewer
                  url={currentAttachment.blobUrl || currentAttachment.remoteUrl}
                  name={currentAttachment.name}
                />
              )}
              {currentAttachment.kind === 'other' && (
                <div className="w-full h-full min-h-[550px] flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                  <FileSpreadsheet className="w-14 h-14 text-emerald-600 mb-3" />
                  <div className="text-base font-semibold text-slate-800">{currentAttachment.name}</div>
                  <p className="text-xs text-slate-500 max-w-md mt-2 leading-relaxed">
                    {currentAttachment.name.endsWith('.dwg')
                      ? 'Bản vẽ kỹ thuật AutoCAD (.dwg). Bạn có thể tải file về máy để mở trực tiếp trên AutoCAD 2018 trở lên.'
                      : currentAttachment.name.endsWith('.xlsx')
                      ? 'Bảng tính Excel (.xlsx). Bạn có thể tải file về máy để xem bảng thống kê khối lượng và chi tiết các tuyến cáp.'
                      : 'Tài liệu kỹ thuật của dự án. Bạn có thể tải file về máy tính để tra cứu chi tiết.'}
                  </p>
                  {(currentAttachment.remoteUrl || currentAttachment.blobUrl) && (
                    <a
                      href={resolveAssetUrl(currentAttachment.blobUrl || currentAttachment.remoteUrl)}
                      download={currentAttachment.name}
                      className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Tải xuống tài liệu ({((currentAttachment.size || 0) / 1024).toFixed(0)} KB)
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs min-h-[400px]">
              <Eye className="w-10 h-10 mb-2 opacity-50" />
              <span>Chọn một tài liệu bên trái để xem trước</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
