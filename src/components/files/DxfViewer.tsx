import React, { useEffect, useRef, useState } from 'react';
import { parseDxfFile, renderDxfToCanvas, DxfRenderStats } from '../../lib/io/dxf';
import { FileCode, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Download } from 'lucide-react';

interface DxfViewerProps {
  content?: string;
  url?: string;
  name: string;
}

export const DxfViewer: React.FC<DxfViewerProps> = ({ content, url, name }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DxfRenderStats | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [dxfData, setDxfData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        let text = content;
        if (!text && url) {
          const res = await fetch(url);
          text = await res.text();
        }
        if (!text) {
          setError('Không có nội dung bản vẽ DXF');
          return;
        }

        const parsed = parseDxfFile(text);
        if (!parsed.success || !parsed.dxf) {
          setError(parsed.error || 'Lỗi khi đọc file DXF');
          return;
        }

        setDxfData(parsed.dxf);
      } catch (err: any) {
        setError(err?.message || 'Không thể tải bản vẽ DXF');
      }
    }
    load();
  }, [content, url]);

  useEffect(() => {
    if (dxfData && canvasRef.current) {
      const renderResult = renderDxfToCanvas(dxfData, canvasRef.current, scale);
      if (renderResult) {
        setStats(renderResult);
      }
    }
  }, [dxfData, scale]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-xs border-b border-slate-700">
        <div className="flex items-center gap-2 truncate">
          <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-medium truncate">{name}</span>
          {stats && (
            <span className="text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
              {stats.entityCount} đối tượng CAD
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale(s => Math.min(5, s + 0.3))}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.2, s - 0.3))}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(1.0)}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Đặt lại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {url && (
            <a
              href={url}
              download={name}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Tải xuống"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 w-full h-[550px] bg-slate-950 flex items-center justify-center relative p-2">
        {error ? (
          <div className="text-center p-6 space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">
              Không hiển thị được bản vẽ — tải xuống để xem
            </div>
            <p className="text-xs text-slate-400 max-w-sm">{error}</p>
            {url && (
              <a
                href={url}
                download={name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Tải xuống file DXF
              </a>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={550}
            className="w-full h-full object-contain rounded"
          />
        )}
      </div>
    </div>
  );
};
