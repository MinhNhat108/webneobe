import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { resolveAssetUrl } from '../../lib/utils/assetUrl';

interface PdfViewerProps {
  url: string;
  name: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, name }) => {
  const resolvedUrl = resolveAssetUrl(url);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-xs border-b border-slate-700">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-medium truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors text-xs font-medium"
            title="Mở tab mới"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở tab mới
          </a>
          <a
            href={resolvedUrl}
            download={name}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-600 hover:bg-brand-500 rounded text-white transition-colors text-xs font-medium"
            title="Tải xuống"
          >
            <Download className="w-3.5 h-3.5" />
            Tải PDF
          </a>
        </div>
      </div>

      <div className="flex-1 w-full h-[640px] bg-slate-950 relative">
        <iframe
          src={resolvedUrl}
          title={name}
          className="w-full h-full border-none"
        />
      </div>
      <div className="bg-slate-900 px-4 py-2 text-[11px] text-slate-400 border-t border-slate-800 flex items-center justify-between">
        <span>Gợi ý: Nếu trình duyệt không tự xem được PDF trong khung, nhấn <strong>Mở tab mới</strong> hoặc <strong>Tải PDF</strong>.</span>
      </div>
    </div>
  );
};
