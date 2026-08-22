import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';

interface PdfViewerProps {
  url: string;
  name: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, name }) => {
  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-xs border-b border-slate-700">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-medium truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Mở tab mới"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={url}
            download={name}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Tải xuống"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex-1 w-full h-[600px] bg-slate-950 relative">
        <iframe
          src={url}
          title={name}
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
};
