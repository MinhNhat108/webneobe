import React, { useState, useMemo, useRef } from 'react';
import huoiVanhCoordinatesData from '../../data/huoiVanhCoordinates.json';
import { MooringCoordinate } from '../../data/huoiVanhProject';
import { useProjectStore } from '../../store/useProjectStore';
import { Map, ZoomIn, ZoomOut, RotateCcw, Filter, Compass } from 'lucide-react';

export const MooringLayoutMap: React.FC = () => {
  const { setActiveRaft } = useProjectStore();
  const [filterRaft, setFilterRaft] = useState<string>('ALL');
  const [selectedAnchor, setSelectedAnchor] = useState<MooringCoordinate | null>(null);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const coordinates: MooringCoordinate[] = huoiVanhCoordinatesData as MooringCoordinate[];

  // Calculate extents from coordinates
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
      minX = Math.min(minX, c.xRaft, c.xAnchor);
      maxX = Math.max(maxX, c.xRaft, c.xAnchor);
      minY = Math.min(minY, c.yRaft, c.yAnchor);
      maxY = Math.max(maxY, c.yRaft, c.yAnchor);
    });
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [coordinates]);

  // Transform coordinates to SVG viewBox (800 x 600)
  const svgWidth = 800;
  const svgHeight = 550;
  const padding = 60;

  const toSvgX = (x: number) => {
    const norm = (x - bounds.minX) / (bounds.width || 1);
    return padding + norm * (svgWidth - 2 * padding);
  };

  const toSvgY = (y: number) => {
    const norm = (y - bounds.minY) / (bounds.height || 1);
    return svgHeight - padding - norm * (svgHeight - 2 * padding);
  };

  // Filtered coordinates
  const displayedCoords = useMemo(() => {
    if (filterRaft === 'ALL') return coordinates;
    return coordinates.filter(c => c.raft.toUpperCase() === filterRaft.toUpperCase());
  }, [coordinates, filterRaft]);

  // Unique rafts
  const uniqueRafts = useMemo(() => {
    const set = new Set<string>();
    coordinates.forEach(c => set.add(c.raft));
    return Array.from(set);
  }, [coordinates]);

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-sky-50 text-sky-600">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              Sơ Đồ Mặt Bằng Tọa Độ Hệ Neo 13 Bè (Huổi Vanh)
            </h3>
            <p className="card-subtitle">
              Biểu diễn 299 tuyến cáp neo, cọc neo bờ (xanh lá) và cọc neo đáy hồ (cam)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Raft Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1 border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterRaft}
              onChange={(e) => {
                setFilterRaft(e.target.value);
                if (e.target.value !== 'ALL') {
                  const num = parseInt(e.target.value.replace(/\D/g, ''));
                  if (num) setActiveRaft(num);
                }
              }}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Toàn bộ 13 Bè</option>
              {uniqueRafts.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Zoom buttons */}
          <button
            type="button"
            onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setScale(1.2); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div
        className="relative w-full h-[520px] bg-slate-950 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-slate-800 select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Compass & Legends */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white space-y-1.5 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-sky-400">
            <Compass className="w-4 h-4" />
            Phương Bắc (N)
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Cọc Neo Bờ (Shore Pile)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span>Cọc Neo Đáy Lòng Hồ (Bed Pile)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 bg-sky-400 inline-block"></span>
            <span>Dây cáp neo</span>
          </div>
        </div>

        {/* Selected anchor info popup */}
        {selectedAnchor && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-sky-500/50 rounded-lg p-3 text-xs text-white z-10 shadow-xl max-w-xs animate-fade-in">
            <div className="flex items-center justify-between font-bold text-sky-400 border-b border-slate-700 pb-1 mb-1.5">
              <span>{selectedAnchor.raft} — {selectedAnchor.code}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedAnchor.type === 'SHORE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {selectedAnchor.type === 'SHORE' ? 'NEO BỜ' : 'NEO ĐÁY'}
              </span>
            </div>
            <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
              <div>Tọa độ Bè: X = {selectedAnchor.xRaft}, Y = {selectedAnchor.yRaft}</div>
              <div>Tọa độ Cọc: X = {selectedAnchor.xAnchor}, Y = {selectedAnchor.yAnchor}</div>
              <div>Cao trình Z: {selectedAnchor.zAnchor} m</div>
              <div>Chiều dài nhịp cáp: <strong className="text-white">{selectedAnchor.span} m</strong></div>
              <div>Góc phương vị: <strong className="text-white">{selectedAnchor.azimuth}°</strong></div>
            </div>
          </div>
        )}

        <svg
          className="w-full h-full"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.4)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

          {/* Mooring Lines */}
          <g>
            {displayedCoords.map((c, idx) => {
              const x1 = toSvgX(c.xRaft);
              const y1 = toSvgY(c.yRaft);
              const x2 = toSvgX(c.xAnchor);
              const y2 = toSvgY(c.yAnchor);
              const isShore = c.type === 'SHORE';

              return (
                <g key={idx} className="cursor-pointer" onClick={() => setSelectedAnchor(c)}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isShore ? 'rgba(52, 211, 153, 0.6)' : 'rgba(251, 191, 36, 0.6)'}
                    strokeWidth="1.2"
                    strokeDasharray={isShore ? 'none' : '3 2'}
                  />
                  {/* Anchor Point Circle */}
                  <circle
                    cx={x2}
                    cy={y2}
                    r="3.5"
                    fill={isShore ? '#10b981' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  {/* Fairlead Raft Point */}
                  <circle
                    cx={x1}
                    cy={y1}
                    r="2"
                    fill="#38bdf8"
                  />
                </g>
              );
            })}
          </g>

          {/* Raft Label Tags */}
          <g>
            {uniqueRafts.map((raftName, idx) => {
              const raftPoints = coordinates.filter(c => c.raft === raftName);
              if (raftPoints.length === 0) return null;
              const avgX = raftPoints.reduce((sum, p) => sum + p.xRaft, 0) / raftPoints.length;
              const avgY = raftPoints.reduce((sum, p) => sum + p.yRaft, 0) / raftPoints.length;
              const sx = toSvgX(avgX);
              const sy = toSvgY(avgY);

              return (
                <g key={idx} className="pointer-events-none">
                  <rect
                    x={sx - 24}
                    y={sy - 10}
                    width="48"
                    height="20"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke="#0284c7"
                    strokeWidth="1"
                  />
                  <text
                    x={sx}
                    y={sy + 4}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {raftName}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Quick Coordinate Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            Bảng tra cứu chi tiết 299 điểm neo (Đang hiển thị {displayedCoords.length} điểm):
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Hệ tọa độ chuẩn bản vẽ thiết kế (m)
          </span>
        </div>

        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Bè</th>
                <th className="px-3 py-2">Mã neo</th>
                <th className="px-3 py-2">Loại neo</th>
                <th className="px-3 py-2">X Bè (m)</th>
                <th className="px-3 py-2">Y Bè (m)</th>
                <th className="px-3 py-2">X Cọc (m)</th>
                <th className="px-3 py-2">Y Cọc (m)</th>
                <th className="px-3 py-2">Z Cọc (m)</th>
                <th className="px-3 py-2">Nhịp dây (m)</th>
                <th className="px-3 py-2">Phương vị (°)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {displayedCoords.slice(0, 50).map((c, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedAnchor(c)}
                  className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-1.5 font-bold text-slate-900">{c.raft}</td>
                  <td className="px-3 py-1.5 font-semibold text-brand-600">{c.code}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.type === 'SHORE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {c.type === 'SHORE' ? 'NEO BỜ' : 'NEO ĐÁY'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{c.xRaft}</td>
                  <td className="px-3 py-1.5">{c.yRaft}</td>
                  <td className="px-3 py-1.5">{c.xAnchor}</td>
                  <td className="px-3 py-1.5">{c.yAnchor}</td>
                  <td className="px-3 py-1.5">{c.zAnchor}</td>
                  <td className="px-3 py-1.5 font-bold text-slate-800">{c.span}</td>
                  <td className="px-3 py-1.5">{c.azimuth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
