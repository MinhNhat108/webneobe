import React, { useState } from 'react';
import { Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
import { resolveAssetUrl } from '../../lib/utils/assetUrl';

interface ImageViewerProps {
  url: string;
  name: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ url, name }) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const resolvedUrl = resolveAssetUrl(url);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-xs border-b border-slate-700">
        <div className="flex items-center gap-2 truncate">
          <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium truncate">{name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Đặt lại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <a
            href={resolvedUrl}
            download={name}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Tải xuống"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex-1 w-full h-[550px] bg-slate-950 flex items-center justify-center overflow-auto p-4 select-none">
        <img
          src={resolvedUrl}
          alt={name}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
        />
      </div>
    </div>
  );
};
