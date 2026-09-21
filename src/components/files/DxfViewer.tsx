import React, { useEffect, useRef, useState, useCallback } from 'react';
import { parseDxfFile, renderDxfToCanvas, DxfRenderStats } from '../../lib/io/dxf';
import { FileCode, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Download, Loader2, Move } from 'lucide-react';
import { resolveAssetUrl } from '../../lib/utils/assetUrl';

interface DxfViewerProps {
  content?: string;
  url?: string;
  name: string;
}

export const DxfViewer: React.FC<DxfViewerProps> = ({ content, url, name }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DxfRenderStats | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dxfData, setDxfData] = useState<any>(null);

  const resolvedUrl = resolveAssetUrl(url);

  // Load DXF content or fetch from URL
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setError(null);
      setScale(1.0);
      setOffset({ x: 0, y: 0 });

      try {
        let text = content;
        if (!text && resolvedUrl) {
          setIsLoading(true);
          setLoadProgress('Đang tải bản vẽ CAD...');
          const res = await fetch(resolvedUrl);
          if (!res.ok) {
            throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}: ${res.statusText}`);
          }
          text = await res.text();
        }

        if (isCancelled) return;

        if (!text) {
          setError('Không tìm thấy nội dung bản vẽ DXF');
          setIsLoading(false);
          return;
        }

        setLoadProgress('Đang phân tích đối tượng hình học CAD...');
        // Let UI breathe before parsing heavy drawing
        setTimeout(() => {
          if (isCancelled) return;
          try {
            const parsed = parseDxfFile(text!);
            if (!parsed.success || !parsed.dxf) {
              setError(parsed.error || 'Lỗi khi giải mã định dạng DXF');
            } else {
              setDxfData(parsed.dxf);
            }
          } catch (e: any) {
            setError(e?.message || 'Lỗi khi dựng mô hình DXF');
          } finally {
            setIsLoading(false);
            setLoadProgress('');
          }
        }, 30);
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Không thể tải bản vẽ DXF');
          setIsLoading(false);
          setLoadProgress('');
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [content, resolvedUrl]);

  // Render to canvas whenever dxfData, scale, or offset changes
  const renderCanvas = useCallback(() => {
    if (!dxfData || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Resize canvas to match display size for crisp HiDPI
    const rect = container.getBoundingClientRect();
    const w = Math.max(600, Math.floor(rect.width));
    const h = Math.max(480, Math.floor(rect.height));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const renderResult = renderDxfToCanvas(dxfData, canvas, scale, offset.x, offset.y);
    if (renderResult) {
      setStats(renderResult);
    }
  }, [dxfData, scale, offset]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(10, Math.max(0.1, prev * zoomFactor)));
  };

  // Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setScale(1.0);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 select-none">
      {/* Header bar */}
      <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between text-white text-xs border-b border-slate-700">
        <div className="flex items-center gap-2 truncate">
          <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold truncate text-slate-100">{name}</span>
          {stats && (
            <span className="text-[10px] text-sky-300 bg-sky-950/80 border border-sky-800 px-2 py-0.5 rounded-full">
              {stats.entityCount.toLocaleString()} đối tượng CAD • {stats.layers.length} lớp (layers)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(10, s * 1.25))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.1, s * 0.8))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              download={name}
              className="inline-flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded text-white text-xs font-medium transition-colors ml-1"
              title="Tải xuống file DXF gốc"
            >
              <Download className="w-3.5 h-3.5" />
              Tải CAD (.dxf)
            </a>
          )}
        </div>
      </div>

      {/* Main Canvas Viewer */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[580px] bg-slate-950 flex items-center justify-center relative overflow-hidden"
      >
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center space-y-3 text-slate-300">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <span className="text-xs font-medium">{loadProgress}</span>
          </div>
        )}

        {error ? (
          <div className="text-center p-6 space-y-3 z-10">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">
              Không thể hiển thị trực tiếp bản vẽ CAD
            </div>
            <p className="text-xs text-slate-400 max-w-md">{error}</p>
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download={name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Tải file DXF về máy để mở bằng AutoCAD
              </a>
            )}
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            />

            {/* Quick overlay helper hint */}
            <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              <span>Kéo chuột để di chuyển • Cuộn chuột để phóng to/thu nhỏ • Nhấn các thẻ BÈ để đối chiếu</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
